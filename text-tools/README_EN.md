# Text Tools (text-tools)

> Text processing tools for Hanako Agent: character counting and text analysis.

## Features

| Tool | Description |
|------|-------------|
| `count_chars` | Count Chinese characters, total characters, and UTF-8 byte length of a document |

## count_chars Tool

Count characters in a document. Two input modes:

- **filePath**: Absolute path to the document file
- **text**: Inline text content

### Statistics returned

| Item | Description |
|------|-------------|
| Chinese characters | All CJK Han characters via Unicode `Script=Han` |
| Non-Han characters | Total minus Chinese characters |
| Total characters | `String.length` — letters, digits, punctuation, spaces, newlines, etc. |
| UTF-8 bytes | Encoded byte length of the text |

## License

SATA-2.0
