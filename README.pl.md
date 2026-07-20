# 🚀 DPN (Direct Package Node)

🇬🇧 [English](README.md) | 🇵🇱 **Polski**

[![License: MIT](https://img.shields.io/badge/Licencja-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/Wersja%20Node.js-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Wersja](https://img.shields.io/badge/wersja-1.1.0-orange.svg)](CHANGELOG.md)

**DPN** to szybki, nowoczesny i autorski menedżer pakietów Node.js stworzony w oparciu o architekturę dowiązań (symlinks/junctions) oraz globalny magazyn pakietów (Content-Addressable Store).

Menedżer zapobiega duplikowaniu plików na dysku i przyspiesza reinstalację pakietów niemal **2x w porównaniu ze standardowym `npm`**.

---

## ✨ Kluczowe Cechy

- 🔄 **Aktualizacje Over-The-Air (OTA) (v1.3.0)**: Wbudowany mechanizm samo-aktualizacji (`dpn upgrade`), który automatycznie pobiera, kompiluje i aktualizuje dpn prosto z GitHuba!
- ⚡ **Równoległe Pobieranie (v1.1.0)**: Wielowątkowe pobieranie pakietów (pula 10 połączeń), dzięki czemu instalacja 30+ pakietów trwa ~3 sekundy!
- 🎨 **Pasek Postępu w Konsoli**: Pasek w czasie rzeczywistym (`[████████░░] 80% Pobieranie express...`).
- 🔗 **Architektura Dowiązań Symlink / Junction**: Zmniejsza zużycie dysku i zapobiega nieformalnym zależnościom (ghost dependencies).
- 📦 **Obsługa Skryptów Wykonywalnych**: Automatycznie konfiguruje wrappery `.bin` (`.cmd`, `.ps1`) dla pakietów CLI (`cowsay`, `esbuild`, `tsc`).
- 🛠️ **Zgodność z SemVer i NPM Registry**: Pełna obsługa `https://registry.npmjs.org` i zakresów SemVer (`^`, `~`, `latest`).

---

## 🚀 Instalacja i Szybki Start

### Instalacja Globalna

Sklonuj repozytorium i połącz `dpn` globalnie w swoim systemie:

```bash
git clone https://github.com/deloskiytbackup/dpn.git
cd dpn
npm install
npm run build
npm link
```

Komenda `dpn` będzie dostępna globalnie w PowerShell i CMD!

---

## 🛠️ Komendy CLI

```bash
# 1. Inicjalizacja nowego pliku package.json
dpn init

# 2. Dodanie nowej zależności
dpn add lodash
dpn add express@latest

# 3. Instalacja wszystkich zależności z package.json
dpn install
# lub skrót
dpn i

# 4. Aktualizacja pakietów projektu do najnowszych wersji z NPM
dpn update
dpn update lodash express

# 5. Automatyczna aktualizacja DPN CLI do najnowszej wersji (OTA)
dpn upgrade

# 6. Uruchamianie skryptów z package.json
dpn run <nazwa_skryptu>m node_modules/.bin
dpn run <nazwa_skryptu>

# 5. Pomoc i wersja
dpn --help
dpn --version
```

---

## 📊 Porównanie Prędkości (Benchmark)

Benchmark wykonany na pakietach `express`, `lodash`, `axios` i `cowsay` wraz ze wszystkimi ich pod-zależnościami (34 unikalne pakiety):

| Menedżer Pakietów | 💥 Warm Cache (Re-instalacja) | ❄️ Cold Cache (Pierwsza instalacja) |
| :--- | :--- | :--- |
| ⚡ **`dpn`** | **3.35 s** 🚀 | **6.40 s** (z pobieraniem równoległym v1.1) |
| 🚀 **`pnpm`** | **8.59 s** | **3.29 s** |
| 🐢 **`npm`** | **42.15 s** | **11.62 s** |

---

## 🏗️ Architektura Projektu

```
dpn/
├── bin/
│   └── dpn.js             # Skrypt CLI z shebang
├── src/
│   ├── cli.ts             # Parser komend i punkt wejściowy CLI
│   ├── ui.ts              # Interaktywny pasek postępu CLI
│   ├── registry.ts        # Pobieranie metadanych i archiwów .tgz z registry.npmjs.org
│   ├── resolver.ts        # Rekurencyjne rozwiązywanie zależności SemVer
│   ├── store.ts           # Obsługa pamięci podręcznej w ~/.dpn/store
│   ├── linker.ts          # Tworzenie dowiązań (symlinks) w node_modules i .bin
│   └── runner.ts          # Wykonywanie skryptów dpn run z poprawnym PATH i symlinkami
├── package.json
├── tsconfig.json
├── CHANGELOG.md
├── README.md              # Dokumentacja w języku angielskim
├── README.pl.md           # Dokumentacja w języku polskim
└── LICENSE
```

---

## 📄 Licencja

Ten projekt jest udostępniany na licencji [MIT](LICENSE).
