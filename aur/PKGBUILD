# Maintainer: liberodark

pkgname=odrive-bin
pkgver=0.2.0
pkgrel=1
pkgdesc="Google Drive GUI"
arch=('x86_64')
url="https://github.com/liberodark/ODrive"
license=('GPL')
depends=('xdg-utils')
source_x86_64=("https://github.com/liberodark/ODrive/releases/download/${pkgver}/odrive_${pkgver}_amd64.deb")
source=($pkgname.desktop
        $pkgname.png)
sha512sums=('f1fcc5af46bfa97a8c70a2c1de0eb21bf6486af3e44e8da3774f8237b22c5816c6616c793493470bb091a956fbc62870dee428b5d5fabb7096e2a7508b9fe99e'
         'e852e6ee2714900b2b484dbe3f9bb69e72895391fed5e6776142c48daaf7e75a8a12908812894e5695277447bd2704cad93cd4f2ed0940ef45008e93b8823dd1')
sha512sums_x86_64=('cb5d3de5b17bdbfa92e6b688117cf0b38eed8c365f08c2a9a72e7662fac6fefef0a24d0fdb8cf10a89839294a3024f4669f0bb1bbeac6c4bcfdb7c455c58b5cc')
        
package() {
  cd $srcdir
  tar xvf data.tar.xz
  cp -r opt $pkgdir
  install -vDm644 $srcdir/$pkgname.desktop $pkgdir/usr/share/applications/$pkgname.desktop
  install -vDm644 $srcdir/$pkgname.png $pkgdir/usr/share/pixmaps/$pkgname.png
}

