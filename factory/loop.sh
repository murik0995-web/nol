#!/bin/zsh
# Continuous factory: shift after shift while the Mac is on. Pauses: 60s after a shipped shift, 5 min after a failed one, 30 min on a usage limit, 10 min if the owner has uncommitted work, 1 h when the backlog is empty.
cd "$HOME/projects/nol" || exit 1
while true; do
  zsh factory/run.sh; rc=$?
  case $rc in
    0) sleep 60 ;;
    2) sleep 300 ;;
    3) sleep 600 ;;
    4) sleep 1800 ;;
    5) sleep 3600 ;;
    *) sleep 300 ;;
  esac
done
