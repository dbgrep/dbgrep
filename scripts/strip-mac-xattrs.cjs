const { execFileSync } = require('child_process')
const path = require('path')

function stripMacXattrs(targetPath, label) {
  if (process.platform !== 'darwin') return
  console.log(`Stripping extended attributes from ${label}...`)
  try {
    execFileSync('dot_clean', ['-s', targetPath], { stdio: 'inherit' })
  } catch {
    // dot_clean may fail on some paths; xattr is the important step
  }
  execFileSync('xattr', ['-cr', targetPath], { stdio: 'inherit' })
}

exports.stripMacXattrs = stripMacXattrs

exports.default = async function afterPack(context) {
  stripMacXattrs(context.appOutDir, 'app bundle')
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  stripMacXattrs(appPath, context.packager.appInfo.productFilename)
}

exports.afterExtract = async function afterExtract(context) {
  stripMacXattrs(context.appOutDir, 'extracted Electron app')
}
