# 보안 운영 원칙

## GitHub 토큰

- Personal Access Token(PAT), Gmail 앱 비밀번호, API 키는 채팅·커밋·이슈·README에 절대 기록하지 않습니다.
- GitHub Actions 시크릿은 Repository secrets에만 보관합니다.
- PAT는 필요한 저장소와 권한만 선택하고, 짧은 만료일을 설정합니다.
- 토큰이 채팅이나 로그에 노출되었다면 GitHub Settings → Developer settings → Personal access tokens에서 즉시 폐기(Revoke)합니다.

## 현재 필요한 시크릿

| 이름 | 용도 |
|---|---|
| `GMAIL_USERNAME` | 자동화 결과 메일 발신 Gmail 주소 |
| `GMAIL_APP_PASSWORD` | Gmail SMTP용 앱 비밀번호 |

시크릿 값은 GitHub UI에서 저장 후 다시 비어 보이는 것이 정상입니다. 보안상 값을 재표시하지 않기 때문입니다.
