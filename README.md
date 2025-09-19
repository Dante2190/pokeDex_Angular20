# Pokédex (Angular 20)

Una Pokédex minimalista hecha con **Angular 20 (standalone + signals)** y **Tailwind CSS**, consumiendo la **[PokeAPI](https://pokeapi.co/)**.  
Lista, busca y filtra Pokémon; muestra detalles en un modal con grito, movimientos, estadísticas base y cadena de evolución.

---

## ✨ Features

- **Listado** con paginación (20 por página) usando `limit`/`offset`.
- **Buscador** por nombre (activa con ≥ 3 letras) + botón ✕ para limpiar.
- **Filtros** por **tipo**, **generación** y **rareza** (common/rare/very-rare/legendary/mythical).
- **Modal de detalle** con:
  - Imagen oficial, nombre, tipos, altura, peso y Base XP
  - **Habilidades**
  - **Movimientos** (nombre, tipo, clase de daño y poder)
  - **Grito** del Pokémon (versión latest + enlace a legacy MP3)
  - **Estadísticas base** (barras)
  - **Cadena de evolución** con flechitas
- **Sin almacenamiento** local (ni cache en storage): solo memoria.
- Código tipado con **interfaces** simples (`PokemonDetail`, `PokemonBasic`, `MoveBasic`, `PokemonSpecies`).

---

## 🛠️ Stack

- **Angular 20** (standalone components, **Signals**, `HttpClient`)
- **Vite builder** (por defecto en Angular 17+)
- **Tailwind CSS**
- **RxJS** (`map`, `switchMap`, `forkJoin`, `catchError`)
- **PokeAPI**: `/pokemon`, `/pokemon/{name}`, `/pokemon-species/{name}`, `/move/{name}`, `evolution-chain`

---

## 📦 Requisitos

- **Node.js** 18+ (recomendado 18/20)
- **Angular CLI** 20 (`npm i -g @angular/cli`)

---

## 🚀 Puesta en marcha

Clona y ejecuta:

```bash
# 1) Instalar dependencias
npm install

# 2) Levantar en dev (http://localhost:4200)
ng serve -o

