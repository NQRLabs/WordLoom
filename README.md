<img alt="wordloom-logo" src="./assets/images/logo.png" style="margin-left:auto; margin-right:auto; display:block; width:250px;"/>

# WordLoom

**WordLoom** is a lightweight, browser-based crossword generator built for rapid puzzle prototyping.  
Paste a word list, adjust parameters, and watch it weave a compact, near-square grid using multi-start heuristics and local hill-climbing — all in real time and entirely offline.

## Overview

WordLoom arranges words into efficient crossword-style grids through a stochastic, multi-start algorithm combined with localized improvement.  
It produces clear, legible layouts and offers live preview, solution toggling, PNG export, and reproducibility through seeded generation.  

Every operation is performed locally using browser-native APIs. No uploads, tracking, or external dependencies — just fast, deterministic puzzle construction.

## Features

- **Instant results:** Paste words, click **Generate**, and get a crossword layout within seconds.  
- **Compact grid generation:** Balances word overlap and aspect ratio using heuristic scoring.  
- **Seeded randomness:** Enter a seed for reproducible puzzles or use random generation.  
- **Local optimization:** Hill-climbing refines placements to improve density and symmetry.  
- **Interactive preview:** Toggle the display of solution letters for testing or presentation.  
- **Export as PNG:** Save the generated crossword directly as an image.  
- **Offline operation:** Fully functional with no internet connection or external assets.  
- **Mobile-friendly UI:** Responsive layout for tablet and touch interaction.

## Technical Notes

### Algorithmic Approach

- **Initial placement:** Uses a multi-start stochastic greedy algorithm to maximize crossings.  
- **Refinement:** Applies local hill-climbing and layout scoring to approach square proportions.  
- **Scoring metrics:** Factors include bounding box area, fill density, crossing count, hole count, and aspect ratio.  
- **Determinism:** A custom Mulberry32-style pseudorandom generator ensures consistent results for identical seeds.

## Intended Users

WordLoom was designed for puzzle creators, game designers, and ARG developers who need to prototype crosswords and word grids quickly.  
It is equally useful for educators, linguists, and hobbyists exploring algorithmic generation techniques.  

The tool emphasizes clarity, reproducibility, and simplicity — a modern workbench for structured wordplay.

## Usage

1. Open the app in your browser.  
2. Paste a list of words (one per line or comma-separated).  
3. Adjust the number of **Restarts** and optionally set a **Seed**.  
4. Click **Generate** to build the crossword.  
5. Use **Show Solution** to toggle letter visibility.  
6. Click **Save PNG** to export the grid as an image.

## License

MIT License — free for modification and use. Attribution appreciated if used publicly.  

## Credit

Created by **NQR** for puzzle authors, ARG designers, and creative technologists who love structure and language.  
If you use *WordLoom* in a project or puzzle event, I’d love to hear about it.
