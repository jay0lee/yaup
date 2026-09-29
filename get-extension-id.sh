#!/bin/bash
# Bash script which takes a private key used to sign Chrome extensions as input
# and outputs the Chrome extension ID that will be generated.
function hex_to_id {
   strout="${1//f/p}"
   strout="${strout//e/o}"
   strout="${strout//d/n}"
   strout="${strout//c/m}"
   strout="${strout//b/l}"
   strout="${strout//a/k}"
   strout="${strout//9/j}"
   strout="${strout//8/i}"
   strout="${strout//7/h}"
   strout="${strout//6/g}"
   strout="${strout//5/f}"
   strout="${strout//4/e}"
   strout="${strout//3/d}"
   strout="${strout//2/c}"
   strout="${strout//1/b}"
   strout="${strout//0/a}"
  echo "$strout"
}

in_file="$1"
if ! [ -f "$in_file" ]; then
  echo "ERROR: File ${in_file} does not exist"
  exit 1
fi

if ! [ -x "$(command -v openssl)" ]; then
  echo 'Error: openssl is not installed and is needed for hashing functions.' >&2
  exit 1
fi

myhash=$(openssl rsa -in "$in_file" -pubout -outform DER 2>/dev/null | openssl dgst -sha256 -r)
myhash="${myhash:0:32}"
id=""
while IFS= read -r -n 1 char; do
  shifted=$(hex_to_id "$char")
  id+="$shifted"
done <<< "$myhash"
echo "$id"
