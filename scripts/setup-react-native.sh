#!/bin/bash

# React Native 프로젝트 설정 스크립트

echo "🚀 React Native 프로젝트 설정을 시작합니다..."

# 프로젝트 이름 확인
PROJECT_NAME="AtoCKoreaMobile"

# 1. React Native 프로젝트 생성
echo "📱 React Native 프로젝트 생성 중..."
npx react-native@latest init $PROJECT_NAME --template react-native-template-typescript

cd $PROJECT_NAME

# 2. 필수 패키지 설치
echo "📦 필수 패키지 설치 중..."

# 네비게이션
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context

# Supabase
npm install @supabase/supabase-js @react-native-async-storage/async-storage

# 네트워크
npm install axios

# UI 라이브러리 (선택)
npm install react-native-paper
npm install react-native-vector-icons

# 3. 디렉토리 구조 생성
echo "📁 디렉토리 구조 생성 중..."
mkdir -p src/screens
mkdir -p src/components
mkdir -p src/navigation
mkdir -p src/services/supabase
mkdir -p src/services/api
mkdir -p src/types
mkdir -p src/utils
mkdir -p src/hooks
mkdir -p src/constants

# 4. .env 파일 생성
echo "⚙️ 환경 변수 파일 생성 중..."
cat > .env << EOF
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
API_BASE_URL=https://atockorea.com/api
EOF

echo "✅ 설정 완료!"
echo ""
echo "다음 단계:"
echo "1. .env 파일에 Supabase 정보 입력"
echo "2. cd $PROJECT_NAME"
echo "3. npm run android"













