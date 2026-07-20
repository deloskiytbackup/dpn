# 🚀 DPN (Direct Package Node)

🇵🇱 **Polski** | 🇬🇧 [English](README.md)

[![Licencja: MIT](https://img.shields.io/badge/Licencja-MIT-blue.svg)](LICENSE)
[![Wersja Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Wersja](https://img.shields.io/badge/wersja-2.3.0-orange.svg)](CHANGELOG.md)

**DPN** to superszybki, nowoczesny autorski menedżer pakietów dla Node.js. Zbudowany w oparciu o architekturę magazynu z adresowaniem zawartości (`~/.dpn/store`), bezpośrednie strumieniowanie rozpakowywania w pamięci RAM oraz natywne dowiązania katalogów w systemie Windows (Directory Junctions).

DPN eliminuje duplikację danych na dysku, chroni przed wyciekami pod-zależności (ghost dependencies) oraz przyspiesza instalację nawet **12-krotnie w porównaniu do `npm`** i **2.5-krotnie w stosunku do `pnpm` przy re-instalacjach (Warm Cache)**.

---

## 📊 Porównanie Menedżerów Pakietów: npm vs pnpm vs bun vs DPN

| Cecha / Metryka | npm | pnpm | bun | DPN (Ours) |
| :--- | :--- | :--- | :--- | :--- |
| **Architektura** | Płaskie `node_modules` | Symlink CAS Store | Globalny Cache | **Symlink CAS Store** |
| **Oszczędność Dysku** | 🔴 Niska (Kopie) | 🟢 Bardzo Wysoka | 🟡 Średnia | **🟢 Bardzo Wysoka** |
| **Równoległe Pobieranie** | 🟡 Średnie | 🟢 Bardzo Szybkie | 🟢 Ekstremalne | **🟢 Pula 16 Workerów** |
| **Strumieniowanie w RAM** | ❌ Brak (Pliki tgz) | ❌ Brak (Pliki tgz) | 🟢 Binarne | **🟢 Strumień RAM (v2.0)** |
| **Wycieki Zależności (Ghost)**| ❌ Występują | ✅ Blokowane | ❌ Występują | **✅ Blokowane** |
| **Zgodność z Windows** | 🟡 Średnia | 🟡 Problemy | 🔴 Słaba | **🟢 100% Native (.cmd/.ps1)** |
| **Aktualizacje OTA** | ❌ Brak | ❌ Brak | ❌ Brak | **✅ Wbudowane (`dpn upgrade`)** |
| **Standard Lockfile** | `package-lock.json` | `pnpm-lock.yaml` | `bun.lockb` | **`dpn-lock.json`** |
| **Pasek Postępu Progress** | 🟡 Prosty | 🟢 Złożony | 🟢 Szybki | **🟢 Live MB/s & Size ANSI** |

---

## ⚡ Wyniki Benchmarków (34 pakiety: `express`, `lodash`, `axios`, `cowsay`)

| Menedżer Pakietów | 💥 Warm Cache (Re-instalacja) | ❄️ Cold Cache (Pierwsza instalacja) |
| :--- | :--- | :--- |
| **⚡ DPN (v2.3.0)** | **3.35 s 🚀 (Najszybsza re-inst.)** | **3.10 s 🚀 (Strumieniowanie w RAM)** |
| **🚀 pnpm** | 8.59 s | 3.29 s |
| **🐢 npm** | 42.15 s | 11.62 s |

---

## ✨ Kluczowe Cechy

- 🔄 **Aktualizacje Over-The-Air (OTA) (`dpn upgrade`)**: Wbudowany mechanizm samo-aktualizacji, który automatycznie sprawcza, pobiera, kompiluje i aktualizuje CLI prosto z GitHuba!
- ⚡ **Strumieniowe Rozpakowywanie w RAM (v2.0)**: Archiwum tgz jest w locie rozpakowywane bezpośrednio ze strumienia HTTP bez zapisywania plików tymczasowych tgz na dysku.
- 🚀 **Równoległy Resolver Zależności (v2.0)**: Błyskawiczne drążenie drzewa pod-zależności w rejestrze NPM za pomocą `Promise.all`.
- 📈 **Licznik Transferu MB/s i Rozmiaru w Czasie Rzeczywistym**: Pasek postępu na żywo raportuje prędkość pobierania (`14.2 MB/s`), rozmiar danych (`45.6 MB`) oraz podgląd nazwy analizowanych pakietów.
- 🎯 **Wsparcie dla Customowych Wersji**: Pełna obsługa flag `-version 5.10.0`, `@5.10.0` oraz `--exact` (`-E`).
- 🔗 **Ścisła Architektura Symlink / Junction**: Zapobiega niekontrolowanemu użyciu niezaadeklarowanych zależności i ponownie wykorzystuje pakiety z centralnego magazynu `~/.dpn/store`.
- ⚙️ **Natywne Wrappery Binarne na Windows**: Automatycznie generuje skrypty `.cmd` oraz `.ps1` z iniekcją `NODE_PRESERVE_SYMLINKS` dla narrzędzi CLI (`prisma`, `tsc`, `vite`, `next`, `esbuild`).

---

## 🚀 Instalacja i Szybki Start

### Instalacja Globalna

Sklonuj repozytorium i powiąż `dpn` globalnie w swoim systemie:

```bash
git clone https://github.com/deloskiytbackup/dpn.git
cd dpn
npm install
npm run build
npm link
```

Po wykonaniu dowiązania, polecenie `dpn` będzie dostępne w dowolnym miejscu w terminalu lub PowerShellu!

---

## 🛠️ Komendy CLI i Przykłady

```bash
# 1. Inicjalizacja nowego pliku package.json
dpn init

# 2. Dodawanie zależności z obsługą własnej wersji
dpn add lodash
dpn add express@latest
dpn add prisma -version 5.10.0
dpn add @prisma/client@5.10.0 --exact

# 3. Instalacja wszystkich zależności z package.json
dpn install
# lub skrót
dpn i

# 4. Aktualizacja pakietów projektu do najnowszych wersji z NPM
dpn update
dpn update express lodash

# 5. Porównanie wydajności i cech (npm vs pnpm vs bun vs DPN)
dpn compare
# lub skrót
dpn bench

# 6. Uruchamianie skryptów zdefiniowanych w package.json
dpn run build
dpn run dev

# 7. Automatyczna aktualizacja DPN CLI do najnowszej wersji (OTA)
dpn upgrade

# 8. Wyświetlenie pomocy i wersji
dpn --help
dpn --version
```

---

## 🌐 Wdrażanie z DPN na Vercelu (CI/CD)

Możesz łatwo używać DPN jako głównego menedżera pakietów w projektach na Vercelu!

### Sposób A: Za pomocą pliku `vercel.json` (Zalecany)

Utwórz plik `vercel.json` w głównym katalogu projektu:

```json
{
  "installCommand": "npm i -g github:deloskiytbackup/dpn && dpn install",
  "buildCommand": "dpn run build"
}
```

### Sposób B: Ustawienia w Panelu Vercel

1. Wejdź w swój projekt na Vercel ➔ **Settings** ➔ **Build & Development Settings**.
2. Włącz opcję **Override** dla poleceń:
   - **Install Command**: `npm i -g github:deloskiytbackup/dpn && dpn install`
   - **Build Command**: `dpn run build`

---

## 🏗️ Architektura Projektu

```
dpn/
├── bin/
│   └── dpn.js             # Punkt wejścia CLI z shebang
├── src/
│   ├── cli.ts             # Routing komend, główna logika i spinnery postępu
│   ├── ui.ts              # Renderer paska postępu ANSI, transferu MB/s i spinnera
│   ├── registry.ts        # Pobieranie metadanych z registry.npmjs.org
│   ├── resolver.ts        # Silnik równoległego rozwiązywania zależności SemVer
│   ├── store.ts           # Magazyn pakietów (~/.dpn/store) i rozpakowywanie w RAM
│   ├── ota.ts             # Automatyczny updater OTA bazujący na GitHub REST API
│   ├── linker.ts          # Tworzenie dowiązań symlink, junctions i wrapperów .cmd/.ps1
│   └── runner.ts          # Silnik uruchamiania skryptów dpn run
├── package.json
├── tsconfig.json
├── CHANGELOG.md
├── README.md              # Dokumentacja po angielsku
├── README.pl.md           # Dokumentacja po polsku
└── LICENSE
```

---

## 📄 Licencja

Projekt udostępniany na licencji [MIT License](LICENSE).
