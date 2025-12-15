import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * LINE OAuth 登录处理
 * 由于 Supabase 不直接支持 LINE，我们需要自定义实现
 */

const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const LINE_REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL 
  ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?provider=line`
  : 'http://localhost:3000/auth/callback?provider=line';

/**
 * GET /api/auth/line
 * 启动 LINE OAuth 流程，重定向到 LINE 授权页面
 */
export async function GET(req: NextRequest) {
  if (!LINE_CHANNEL_ID) {
    // 如果 LINE 未配置，重定向回登录页并显示错误
    const errorUrl = new URL(req.url);
    errorUrl.pathname = '/signin';
    errorUrl.searchParams.set('error', 'LINE OAuth is not configured. Please contact support.');
    return NextResponse.redirect(errorUrl.toString());
  }

  // LINE OAuth 授权 URL
  const authUrl = new URL('https://access.line.me/oauth2/v2.1/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', LINE_CHANNEL_ID);
  authUrl.searchParams.set('redirect_uri', LINE_REDIRECT_URI);
  authUrl.searchParams.set('state', 'line_oauth_state'); // 可以添加随机字符串增强安全性
  authUrl.searchParams.set('scope', 'profile openid email');
  authUrl.searchParams.set('bot_prompt', 'normal');

  // 重定向到 LINE 授权页面
  return NextResponse.redirect(authUrl.toString());
}

/**
 * POST /api/auth/line/callback
 * 处理 LINE OAuth 回调，交换 code 获取 token，然后创建/登录用户
 */
export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      );
    }

    if (!LINE_CHANNEL_ID || !LINE_CHANNEL_SECRET) {
      return NextResponse.json(
        { error: 'LINE credentials are not configured' },
        { status: 500 }
      );
    }

    // 1. 交换 code 获取 access token
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: LINE_REDIRECT_URI,
        client_id: LINE_CHANNEL_ID,
        client_secret: LINE_CHANNEL_SECRET,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      return NextResponse.json(
        { error: 'Failed to exchange code for token', details: tokenData },
        { status: 400 }
      );
    }

    // 2. 使用 access token 获取用户信息
    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const profile = await profileResponse.json();

    if (!profileResponse.ok || !profile.userId) {
      return NextResponse.json(
        { error: 'Failed to get user profile', details: profile },
        { status: 400 }
      );
    }

    // 3. 获取 ID token（如果可用）以获取邮箱
    let email = null;
    if (tokenData.id_token) {
      try {
        // 解码 ID token（简化版，生产环境应使用 JWT 库验证）
        const idTokenParts = tokenData.id_token.split('.');
        if (idTokenParts.length === 3) {
          const payload = JSON.parse(
            Buffer.from(idTokenParts[1], 'base64').toString()
          );
          email = payload.email;
        }
      } catch (e) {
        console.error('Failed to decode ID token:', e);
      }
    }

    // 4. 在 Supabase 中创建或登录用户
    const supabase = createServerClient();

    // 使用 LINE userId 作为唯一标识
    // 格式：line_{userId}@line.local
    const lineEmail = email || `line_${profile.userId}@line.local`;

    // 检查用户是否已存在（通过 listUsers 查找）
    let user;
    try {
      // 尝试通过 listUsers 查找用户
      const { data: usersList, error: listError } = await supabase.auth.admin.listUsers();
      const existingUser = usersList?.users?.find(u => u.email === lineEmail);
      
      if (existingUser) {
        // 用户已存在
        user = existingUser;
      } else {
        // 创建新用户
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: lineEmail,
          email_confirm: true,
          user_metadata: {
            provider: 'line',
            line_user_id: profile.userId,
            display_name: profile.displayName,
            picture_url: profile.pictureUrl,
          },
        });

        if (createError || !newUser.user) {
          // 如果创建失败，可能是用户已存在，尝试再次查找
          if (createError?.message?.includes('already registered') || createError?.message?.includes('already exists')) {
            const { data: usersList2 } = await supabase.auth.admin.listUsers();
            const foundUser = usersList2?.users?.find(u => u.email === lineEmail);
            if (foundUser) {
              user = foundUser;
            } else {
              return NextResponse.json(
                { error: 'Failed to create user', details: createError },
                { status: 400 }
              );
            }
          } else {
            return NextResponse.json(
              { error: 'Failed to create user', details: createError },
              { status: 400 }
            );
          }
        } else {
          user = newUser.user;

          // 创建用户资料
          const { error: profileInsertError } = await supabase.from('user_profiles').insert({
            id: user.id,
            full_name: profile.displayName || 'LINE User',
            avatar_url: profile.pictureUrl,
            role: 'customer', // 默认角色
          });

          if (profileInsertError) {
            console.error('Error creating user profile:', profileInsertError);
            // 即使创建失败也继续，但记录错误
          }
        }
      }
    } catch (error: any) {
      return NextResponse.json(
        { error: 'Failed to process user', details: error.message },
        { status: 500 }
      );
    }

    // 5. 生成 magic link 用于自动登录
    // 由于无法直接创建 session，我们返回一个 token 让前端处理
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: lineEmail,
    });

    if (linkError || !linkData) {
      // 如果生成 magic link 失败，返回用户信息让前端手动处理
      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          metadata: user.user_metadata,
        },
        profile: {
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
          userId: profile.userId,
        },
        // 前端需要手动调用 signInWithPassword 或使用其他方式
        requiresManualLogin: true,
      });
    }

    // 返回 magic link 和用户信息
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        metadata: user.user_metadata,
      },
      profile: {
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
        userId: profile.userId,
      },
      magicLink: linkData.properties.action_link,
    });
  } catch (error: any) {
    console.error('LINE OAuth error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

