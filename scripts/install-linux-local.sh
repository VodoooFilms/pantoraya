#!/usr/bin/env bash
set -euo pipefail

if [[ $(uname -s) != Linux ]]; then
  echo 'This installer is for Linux only.' >&2
  exit 1
fi

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
package_file=${1:-"$project_root/dist/Pantoraya-1.3.0-amd64.deb"}
if [[ ! -f $package_file ]]; then
  echo "Package not found: $package_file" >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo 'Install the ffmpeg package before installing Pantoraya.' >&2
  exit 1
fi

stage=$(mktemp -d)
trap 'rm -rf -- "$stage"' EXIT
dpkg-deb -x "$package_file" "$stage"

install_dir="$HOME/.local/opt/Pantoraya"
bin_dir="$HOME/.local/bin"
applications_dir="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
icons_dir="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/1024x1024/apps"
mkdir -p "$HOME/.local/opt" "$bin_dir" "$applications_dir" "$icons_dir"
mkdir -p "$install_dir"
cp -a "$stage/opt/Pantoraya/." "$install_dir/"
install -m 644 "$stage/usr/share/icons/hicolor/1024x1024/apps/pantoraya.png" "$icons_dir/pantoraya.png"
ln -sfn "$install_dir/pantoraya" "$bin_dir/pantoraya"

cat > "$applications_dir/pantoraya.desktop" <<EOF
[Desktop Entry]
Name=Pantoraya
Comment=Private, offline MP4, MP3 and JPG conversion
Exec="$install_dir/pantoraya"
Terminal=false
Type=Application
Icon=$icons_dir/pantoraya.png
Categories=AudioVideo;
StartupWMClass=pantoraya
EOF

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$applications_dir"
fi
echo "Pantoraya installed at $install_dir"
