# Human steps

What only the owner can do, because it needs their npm login and 2FA.

## Before the first release (once)

npm only accepts a trusted publisher for a package that already exists, so
the name is created with a placeholder first. Turn on 2FA for the npm
account, then in an empty folder outside the repo:

```sh
echo '{"name":"better-poker-engine","version":"0.0.1","description":"Placeholder. First release coming soon.","license":"MIT"}' > package.json
npm login
npm publish
```

On the day of the first tagged release (a trusted publisher that is not used
within 2 days expires), open the package on npmjs.com, go to Settings →
Trusted Publisher → GitHub Actions and enter:

- Organization or user: `LukeberryPi`
- Repository: `better-poker-engine`
- Workflow filename: `release.yml`
- Environment name: `npm`

Leave direct `npm publish` unchecked, so CI can only stage a release.

## Every release

1. Bump `version` in `packages/better-poker-engine/package.json` in a PR and
   merge it.
2. Tag the merge commit on `main` with `v<version>` and push the tag. The
   release workflow stops if the tag is not on `main` or does not match the
   version. For 0.1.0:

   ```sh
   git switch main && git pull
   git tag v0.1.0
   git push origin v0.1.0
   ```

3. When the `release` workflow finishes, approve the version on npmjs.com in
   the package's Staged Packages tab. Approval asks for 2FA.

## After the first release (once)

- In the package's Settings → Publishing access, choose "Require two-factor
  authentication and disallow tokens".
- Deprecate the placeholder:
  `npm deprecate better-poker-engine@0.0.1 "Placeholder. Use 0.1.0 or later."`
