#!/bin/bash
# Simple line counter script for testing
echo "Line Count: $(echo -e "$1" | wc -l)"
