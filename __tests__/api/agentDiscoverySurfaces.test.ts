/**
 * @jest-environment node
 *
 * 에이전트 발견(discovery) 표면 계약.
 *
 * 채널 자체는 이미 라이브다(`/llms.txt` · `/.well-known/agent.json` ·
 * `/api/agent/v1/*` · `/for-agents`). 없던 건 **찾아지는 경로**였다 — 도메인만
 * 아는 크롤러/MCP 클라이언트가 관례적 위치에서 집어갈 수 있는 피드와 서버 카드.
 * 이 트랙은 사장님이 "고객 확보 게이트"라고 못 박은 영역이라, 계약을 테스트로
 * 고정한다.
 *
 * 고정하는 것 세 가지:
 *   ① 피드는 `lib/agent/catalog` 하나만 본다 — 낡은 브랜치가 들고 있던
 *      `lib/agent-channel/site.ts`처럼 **두 번째 진실**이 생기면 카탈로그와
 *      피드가 조용히 갈라진다.
 *   ② **가격은 1인 정가이고 그렇게 말한다.** 청구 가능한 총액처럼 보이면
 *      피드가 사업 방식을 거짓말하는 것이다 — 총액은 서명된 견적에만 있다.
 *   ③ **에이전트는 카드를 긁지 않는다**가 모든 표면에서 같은 말이어야 한다.
 */
import { GET as acpFeed } from '@/app/feed/acp-products.json/route';
import { GET as mcpCard } from '@/app/.well-known/mcp/server-card.json/route';
import { listAgentCatalog } from '@/lib/agent/catalog';

describe('agent discovery surfaces', () => {
  it('the product feed projects the SAME catalogue, not a second one', async () => {
    const body = await (await acpFeed()).json();
    const catalog = listAgentCatalog();
    expect(body.products).toHaveLength(catalog.length);
    expect(body.products.map((p: { id: string }) => p.id).sort()).toEqual(
      catalog.map((t) => t.slug).sort(),
    );
  });

  it('prices are per-traveller list prices and say so', async () => {
    const body = await (await acpFeed()).json();
    for (const p of body.products) {
      expect(p.price.currency).toBe('USD');
      expect(p.price.unit).toBe('per_traveller');
      expect(typeof p.price.value).toBe('number');
    }
    // The authoritative number lives behind the quote endpoint, and the feed
    // has to point at it rather than imply the list price is chargeable.
    expect(body.fulfillment.quote_endpoint).toMatch(/\/api\/agent\/v1\/quote$/);
  });

  it('every surface tells an agent the same thing about payment', async () => {
    const feed = await (await acpFeed()).json();
    const card = await (await mcpCard()).json();
    expect(feed.fulfillment.agent_charges_card).toBe(false);
    expect(card.payment.agent_charges_card).toBe(false);
    expect(card.payment.model).toBe(feed.fulfillment.model);
  });

  it('the MCP card points at the endpoint that actually exists', async () => {
    const card = await (await mcpCard()).json();
    // main serves MCP at /api/agent/mcp; an older branch used /api/mcp. A card
    // advertising the wrong one is worse than no card.
    expect(card.transport.url).toMatch(/\/api\/agent\/mcp$/);
    expect(card.related.agent_manifest).toMatch(/\/\.well-known\/agent\.json$/);
    expect(card.related.product_feed).toMatch(/\/feed\/acp-products\.json$/);
  });

  it('both surfaces are crawlable cross-origin and cached', async () => {
    for (const res of [await acpFeed(), await mcpCard()]) {
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
      expect(res.headers.get('cache-control')).toContain('s-maxage');
    }
  });
});
