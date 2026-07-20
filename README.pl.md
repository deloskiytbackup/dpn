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

- ⚡ **Równoległe pobieranie (v1.1.0)**: Pula współbieżnych połączeń (do 10 pobrań jednocześnie) redukuje czas czystej instalacji z 62s do ~3 sekund!
- 🎨 **Pasek Postępu CLI**: Interaktywny wskaźnik postępu w czasie rzeczywistym (`[████████░░] 80% (27/34) Pobieranie...`).
- 🔗 **Architektura Symlink / Junction**: Ścisła struktura `node_modules` budowana na dowiązaniach chroni projekt przed wyciekami zależności i oszczędza miejsce na dysku.
- 📦 **Automatyczna obsługa `.bin`**: Tworzenie skryptów wykonywalnych (Windows `.cmd`/`.ps1` oraz Unix) w katalogu `node_modules/.bin`.
- 🛠️ **Kompatybilność z Node.js & SemVer**: Pełna obsługa oficjalnego rejestru npm (`https://registry.npmjs.org`) oraz specyfikacji zakresów wersji SemVer (`^`, `~`, `latest`).

---

## 🚀 Instalacja i Szybki Start

### Globalna instalacja

Sklonuj repozytorium i zainstaluj `dpn` globalnie w swoim systemie:

```bash
git clone https://github.com/deloskiytbackup/dpn.git
cd dpn
npm install
npm run build
npm link
```

Po wykonaniu powyższych kroków polecenie `dpn` jest dostępne globalnie w Twoim terminalu!

---

## 🛠️ Dostępne Komendy

```bash
# 1. Inicjalizacja nowego pliku package.json
dpn init

# 2. Dodanie nowej zależności do projektu
dpn add lodash
dpn add express@latest

# 3. Zainstalowanie wszystkich zależności z package.json
dpn install
# lub w wersji skróconej
dpn i

# 4. Uruchomienie skryptu z package.json z dołączonym node_modules/.bin
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
