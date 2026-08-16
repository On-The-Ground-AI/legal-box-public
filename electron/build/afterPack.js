// Ad-hoc codesign the packaged macOS app.
//
// We build without an Apple Developer ID, but "unsigned" and "no signature
// at all" are different things on Apple Silicon: the kernel refuses to
// execute an arm64 bundle that carries no code signature, and the failure
// surfaces to the user as "OTG Legal Box is damaged and can't be opened" —
// which reads like a corrupt download rather than a signing gap, and sends
// people back to the download page instead of through Gatekeeper.
//
// An ad-hoc signature ("-") satisfies that requirement. It does NOT make the
// app notarized: first launch still shows the unidentified-developer prompt
// and still needs the one-time Open Anyway step in INSTALL.md. Replacing
// this with a real Developer ID is docs/CODE_SIGNING_ENROLLMENT.md.

const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );
  const entitlements = path.join(__dirname, 'entitlements.mac.plist');

  // --deep also covers the nested PyInstaller backend and the bundled Ollama
  // binary under Contents/Resources; extraResources are already in place by
  // the time afterPack runs. --options runtime matches hardenedRuntime: true
  // in the build config, so the entitlements actually take effect.
  execFileSync(
    'codesign',
    [
      '--force',
      '--deep',
      '--sign', '-',
      '--options', 'runtime',
      '--entitlements', entitlements,
      appPath,
    ],
    { stdio: 'inherit' },
  );

  execFileSync('codesign', ['--verify', '--verbose=2', appPath], {
    stdio: 'inherit',
  });

  console.log(`  • ad-hoc signed ${appPath}`);
};
