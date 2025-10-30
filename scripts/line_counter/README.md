# Line Counter Script

This script counts the number of lines in the provided text input.

## Usage

```bash
./line_counter.sh "Hello\nWorld\nTest"
```

## Expected Output

```
Line Count: 3
```

## Description

The script takes a single argument containing text (which can include newlines) and outputs the number of lines in that text. It uses the `wc -l` command to count the lines after echoing the input with proper newline interpretation.

## Example Commands

- Count lines in simple text: `./line_counter.sh "Hello World"`
- Count lines in multi-line text: `./line_counter.sh "Line 1\nLine 2\nLine 3"`
- Count empty input: `./line_counter.sh ""`
