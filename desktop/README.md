# RoomChat Windows 앱

RoomChat 웹 서비스를 Electron 데스크톱 창에서 실행하는 Windows용 앱입니다.

## 개발 실행

```bash
npm install
npm start
```

## Windows 설치 파일 만들기

Windows 환경에서:

```bash
npm install
npm run dist
```

설치 파일은 `dist/RoomChat-Setup-1.0.0.exe`로 생성됩니다. GitHub Actions의 **Build RoomChat Windows app** 워크플로도 같은 설치 파일을 빌드해 GitHub Release에 게시합니다.

## 동작 방식과 보안

- 앱은 `https://xlg77.github.io/roomchat/`의 최신 RoomChat 웹앱을 표시합니다.
- 로그인, Supabase Realtime, 채팅 데이터는 웹 버전과 동일한 서버를 사용합니다.
- Electron의 Node 통합은 끄고 context isolation과 sandbox를 켭니다.
- RoomChat 외부 사이트 링크는 기본 브라우저에서 엽니다.
- 웹앱 알림 권한은 RoomChat 출처에 한해 허용합니다.
- 인터넷 연결이 필요합니다. 오프라인 채팅이나 로컬 데이터베이스를 별도로 만들지 않습니다.
