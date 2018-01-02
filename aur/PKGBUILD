# Maintainer: liberodark

pkgname=odrive-bin
pkgver=0.1.2
pkgrel=1
pkgdesc="Google Drive GUI"
arch=('x86_64')
url="https://github.com/liberodark/ODrive"
license=('GPL')
depends=('xdg-utils')
source_x86_64=("https://github.com/liberodark/ODrive/releases/download/${pkgver}/odrive-linux-x64.tar.gz")
source=($pkgname.desktop
        $pkgname.png)
sha512sums=('21f1af6ea861679b8338daad978ace9f66e2177d1897643f87aacd291ca5a35ddab50efee3dfcdbd4fbb015bdaf8f0589ef90fbec7c8e0ad3a71cfa32e7ea18b'
         'e852e6ee2714900b2b484dbe3f9bb69e72895391fed5e6776142c48daaf7e75a8a12908812894e5695277447bd2704cad93cd4f2ed0940ef45008e93b8823dd1')
sha512sums_x86_64=('176ac54f96cd8127892768fd5b92ec095150114615e95197f28fa37f6449bf11ee3f96f9a41e896d0cdefe9eb6dba336b3385324b865d05c0a676c068f1f570d')
        
package() {
  cd $srcdir
  tar xvf odrive-linux-x64.tar.gz
  mkdir -p "$pkgdir/usr/share/odrive"
  cp -r "odrive-linux-x64/." "$pkgdir/usr/share/odrive"
  chmod 755 -R "$pkgdir/usr/share/odrive/resources/app"
  install -vDm644 $srcdir/$pkgname.desktop $pkgdir/usr/share/applications/$pkgname.desktop
  install -vDm644 $srcdir/$pkgname.png $pkgdir/usr/share/pixmaps/$pkgname.png
}

