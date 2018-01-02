# Maintainer: liberodark

pkgname=odrive-bin
pkgver=0.1.2
pkgrel=2
pkgdesc="Google Drive GUI"
arch=('x86_64')
url="https://github.com/liberodark/ODrive"
license=('GPL')
depends=('xdg-utils')
source_x86_64=("https://github.com/liberodark/ODrive/releases/download/${pkgver}/odrive-linux-x64.tar.gz")
source=($pkgname.desktop
        $pkgname.png)
sha512sums=('37059f82eaed9f22a0cffa621a6a9d08410c6dfb37dddbc33db7e7cbd5c2008b152d4cc909b229dc9b4657135c01e3f97cff4409556b253014ac52833b794e4a'
         'e852e6ee2714900b2b484dbe3f9bb69e72895391fed5e6776142c48daaf7e75a8a12908812894e5695277447bd2704cad93cd4f2ed0940ef45008e93b8823dd1')
sha512sums_x86_64=('e18d1141f32875f139aeb1327e2a298f71b01e721b72621d560b2d7e5a251197897dc93d10988067b70e2fa9368029aaba2c7cd564562f528522d5a1187c00e1')
        
package() {
  cd $srcdir
  tar xvf odrive-linux-x64.tar.gz
  mkdir -p "$pkgdir/usr/share/odrive"
  cp -r "odrive-linux-x64/." "$pkgdir/usr/share/odrive"
  chmod 755 -R "$pkgdir/usr/share/odrive/resources/app"
  install -vDm644 $srcdir/$pkgname.desktop $pkgdir/usr/share/applications/$pkgname.desktop
  install -vDm644 $srcdir/$pkgname.png $pkgdir/usr/share/pixmaps/$pkgname.png
}

