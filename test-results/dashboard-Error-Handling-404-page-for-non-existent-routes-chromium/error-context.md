# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - img [ref=e5]
    - banner [ref=e38]:
      - link "Flowsmith" [ref=e39] [cursor=pointer]:
        - /url: /
        - img [ref=e41]
        - generic [ref=e43]: Flowsmith
    - generic [ref=e45]:
      - generic [ref=e46]:
        - heading "Sign in to Flowsmith" [level=1] [ref=e47]
        - paragraph [ref=e48]: Welcome back. Enter your credentials to continue.
      - paragraph [ref=e50]:
        - text: Don't have an account?
        - link "Sign up" [ref=e51] [cursor=pointer]:
          - /url: /sign-up
      - paragraph [ref=e52]:
        - text: By continuing, you agree to our
        - link "Terms" [ref=e53] [cursor=pointer]:
          - /url: /terms
        - text: and
        - link "Privacy" [ref=e54] [cursor=pointer]:
          - /url: /privacy
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e60] [cursor=pointer]:
    - img [ref=e61]
  - alert [ref=e64]
```