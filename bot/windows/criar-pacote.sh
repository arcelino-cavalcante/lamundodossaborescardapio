#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
bot_dir="$(cd "$script_dir/.." && pwd)"
project_dir="$(cd "$bot_dir/.." && pwd)"
release_dir="$project_dir/releases"
work_dir="$(mktemp -d)"
package_name="robozinho-la-mundo-windows"
package_dir="$work_dir/$package_name"

cleanup() {
  rm -rf "$work_dir"
}
trap cleanup EXIT

mkdir -p "$package_dir/app" "$release_dir"
cp "$script_dir/INSTALAR.bat" "$script_dir/instalar.ps1" "$script_dir/LEIA-ME.txt" "$package_dir/"
cp "$bot_dir/app.js" "$bot_dir/manager.js" "$bot_dir/package.json" "$bot_dir/package-lock.json" "$bot_dir/README.md" "$bot_dir/.env.example" "$package_dir/app/"
cp -R "$bot_dir/dashboard" "$bot_dir/src" "$bot_dir/scripts" "$bot_dir/test" "$package_dir/app/"
cp "$script_dir/runtime/"* "$package_dir/app/"

rm -f "$release_dir/$package_name.zip"
(
  cd "$work_dir"
  zip -q -r "$release_dir/$package_name.zip" "$package_name"
)

echo "$release_dir/$package_name.zip"
