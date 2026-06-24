Monkey Type x Bible Memory Pro

A .NET scripture memorization app with a clean typing-test UI and a three-step memorization flow.

## Features

- **Monkeytype-inspired UI** — dark theme, monospace typing area, live WPM/accuracy stats
- **Type It** — type the full verse character by character
- **Memorize It** — first-letter recall (Bible Memory Pro style)
- **Master It** — hidden words revealed as you type from memory
- **Verse library** — browse topical collections and track progress per verse
- **Local progress** — stages, accuracy, and best WPM saved in your browser

## Run

```bash
dotnet run
```

Open [http://localhost:5000](http://localhost:5000) (or the URL shown in the terminal).

## Stack

- ASP.NET Core 8 (Razor Pages + minimal API)
- Vanilla JavaScript for the typing engine
- Sample ESV verses in `Data/verses.json`
