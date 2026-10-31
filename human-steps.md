# Human steps

What only the owner can do, because it needs their npm login and 2FA. Run
commands from the repo folder.

The name `better-poker-engine` is already registered on npm to the owner,
holding two placeholder versions: `0.0.0-stage` and `0.0.1`. Step 6 of the
first release deprecates them.

## First release (0.1.0)

1. Merge [#10](https://github.com/LukeberryPi/better-poker-engine/pull/10)
   (Bun 1.4.4), then
   [#11](https://github.com/LukeberryPi/better-poker-engine/pull/11)
   (version 0.1.0).

2. Connect npm to the release workflow. Do this on the same day as step 3,
   because npm drops a trusted publisher that goes unused for 2 days.
   1. Open <https://www.npmjs.com/package/better-poker-engine/access>.
   2. Under **Trusted Publisher**, choose **GitHub Actions**.
   3. Fill in:
      - Organization or user: `LukeberryPi`
      - Repository: `better-poker-engine`
      - Workflow filename: `release.yml`
      - Environment name: `npm`
   4. Leave direct `npm publish` unchecked, so CI can only stage a release.
      Save.

3. Tag the release and push the tag:

   ```sh
   git switch main
   git pull
   git tag v0.1.0
   git push origin v0.1.0
   ```

4. Wait until both jobs, `pack` and `stage`, are green in
   [the release workflow](https://github.com/LukeberryPi/better-poker-engine/actions/workflows/release.yml).
   `pack` refuses a tag that is not on `main` or does not match `version` in
   `packages/better-poker-engine/package.json`.

5. Open <https://www.npmjs.com/package/better-poker-engine>, go to the
   **Staged Packages** tab, approve `0.1.0` and enter your 2FA code. Then
   confirm it is live:

   ```sh
   npm view better-poker-engine version   # prints 0.1.0
   ```

6. Deprecate the placeholders:

   ```sh
   npm deprecate better-poker-engine@0.0.0-stage "Placeholder. Use 0.1.0 or later."
   npm deprecate better-poker-engine@0.0.1 "Placeholder. Use 0.1.0 or later."
   ```

7. Open <https://www.npmjs.com/package/better-poker-engine/access>, set
   **Publishing access** to "Require two-factor authentication and disallow
   tokens", and save.

## Every later release

1. In a PR, set the new version in `packages/better-poker-engine/package.json`
   and `packages/better-poker-engine/src/version.ts`. Merge it.
2. Tag and push `v<version>`, as in step 3 above.
3. Wait for the workflow and approve on npm, as in steps 4 and 5 above.
