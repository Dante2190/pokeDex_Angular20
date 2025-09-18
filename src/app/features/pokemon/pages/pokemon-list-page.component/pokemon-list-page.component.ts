import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { PokeApiService } from '../../../../core/services/poke-api.service';
import { PokemonBasic } from '../../../../shared/models/pokemon-basic.model';
import { PokemonDetail } from '../../../../shared/models/pokemon-detail.model';
import { PokemonSpecies } from '../../../../shared/models/species.model';
import { Rarity } from '../../../../shared/models/rarity.type';
import { MoveBasic } from '../../../../shared/models/move-basic.model';

type CardItem = {
  id: number;
  name: string;
  imageUrl: string;
  types?: string[];
  height?: number;
  weight?: number;
  baseExp?: number
};

type PokeListItem = { name: string; url: string };
/* type Rarity = 'common' | 'rare' | 'very-rare' | 'legendary' | 'mythical'; */

type EvoStage = {
  name: string;
  id: number;
  imageUrl: string;
  note?: string;     // condición simple (p. ej. "Nv.16", "Ítem: moon-stone")
};


const BASE_URL = 'https://pokeapi.co/api/v2';

// Generaciones (por rango de ID)
const GEN_RANGES: Record<number, [number, number]> = {
  1: [1, 151],
  2: [152, 251],
  3: [252, 386],
  4: [387, 493],
  5: [494, 649],
  6: [650, 721],
  7: [722, 809],
  8: [810, 905],
  9: [906, 1025],
};

const TYPES_ORDER = [
  'normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel',
  'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy'
] as const;

// estado principal
const pokemons = signal<PokemonBasic[]>([]);

// ↓ detalle del modal, con tipo
/* const ddata = signal<PokemonDetail | null>(null); */

/* let moves = signal<MoveBasic[]>([]);  */  // 👈 lista para el modal

// Lista de movimientos mostrados en el modal
/* moves = signal<MoveBasic[]>([]); */


@Component({
  selector: 'app-pokemon-list-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pokemon-list-page.component.html',
})
export class PokemonListPageComponent implements OnInit {
  private api = inject(PokeApiService);
  private http = inject(HttpClient);



  // === Paginación (20 fijos) ===
  pageSize = 20;
  page = signal(1);
  total = signal(0);
  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  pokemons = signal<CardItem[]>([]);
  loading = signal(true);

  // === Modal ===
  modalOpen = signal(false);
  ddata = signal<PokemonDetail | null>(null);
  selectedName = signal<string | null>(null);
  evolution = signal<EvoStage[]>([]);
  moves = signal<MoveBasic[]>([]);


  dloading = signal(false);
  derror = signal<string | null>(null);

  // === Buscador (≥3 letras) ===
  q = signal('');
  minQueryMet = computed(() => this.q().trim().length >= 3);

  // === Filtros ===
  typeOptions = signal<string[]>([]);
  selectedType = signal<string | null>(null);
  selectedGen = signal<number | null>(null);
  selectedRarity = signal<Rarity | null>(null);

  // ¿Hay búsqueda o filtros activos?
  isAltMode = computed(() =>
    this.minQueryMet() || !!this.selectedType() || !!this.selectedGen() || !!this.selectedRarity()
  );



  ngOnInit(): void {
    this.loadPage(); // modo normal

    // Cargar tipos para los chips
    this.api.getTypes().subscribe({
      next: t => this.typeOptions.set(TYPES_ORDER.filter(x => t.includes(x))),
      error: () => this.typeOptions.set(TYPES_ORDER as any),
    });
  }

  /** Modo normal (sin búsqueda ni filtros): usa limit/offset del endpoint */
  loadPage() {
    this.loading.set(true);
    const offset = (this.page() - 1) * this.pageSize;
    this.api.getPokemonPage(this.pageSize, offset).subscribe({
      next: ({ count, items }) => {
        this.total.set(count);
        this.pokemons.set(items);
        this.loading.set(false);

        this.pokemons.set(items);
        this.enrichPage(items);
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: () => { this.total.set(0); this.pokemons.set([]); this.loading.set(false); }
    });
  }

  /** Modo alterno (hay búsqueda o filtros): filtra y pagina localmente (20) */
  rebuildView() {
    if (!this.isAltMode()) { this.loadPage(); return; }

    this.loading.set(true);

    this.api.getAllBasic().pipe(
      // si hay tipo, obtener set de nombres por tipo
      switchMap((base) => {
        const type = this.selectedType();
        if (!type) return of({ base, typeSet: null as Set<string> | null });
        return this.api.getPokemonNamesByType(type).pipe(
          map(names => ({ base, typeSet: new Set(names) }))
        );
      }),
      // filtrar por prefijo + generación + tipo
      map(({ base, typeSet }) => {
        const prefix = this.q().trim().toLowerCase();
        return filterCards(base, {
          prefix,
          typeSet,
          generation: this.selectedGen()
        }); // CardItem[]
      }),
      // rareza si aplica (consulta species SOLO de los candidatos actuales)
      switchMap((cards) => {
        const r = this.selectedRarity();
        if (!r) return of(cards);

        const reqs = cards.map(c =>
          this.http.get<any>(`${BASE_URL}/pokemon-species/${c.name}`).pipe(
            map(sp => ({ name: c.name, r: rarityFromSpecies(sp) })),
            catchError(() => of({ name: c.name, r: 'common' as Rarity }))
          )
        );
        return forkJoin(reqs).pipe(
          map(entries => {
            const mapR = new Map(entries.map(e => [e.name, e.r]));
            return cards.filter(c => mapR.get(c.name) === r);
          })
        );
      })
    ).subscribe({
      next: (full) => {
        this.total.set(full.length);
        const offset = (this.page() - 1) * this.pageSize;
        this.pokemons.set(full.slice(offset, offset + this.pageSize));
        this.loading.set(false);
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: () => { this.total.set(0); this.pokemons.set([]); this.loading.set(false); }
    });
  }

  // === Interacciones ===
  onSearchInput(value: string) { this.q.set(value); this.page.set(1); this.rebuildView(); }
  toggleType(t: string) { this.selectedType.set(this.selectedType() === t ? null : t); this.page.set(1); this.rebuildView(); }
  toggleGen(g: number) { this.selectedGen.set(this.selectedGen() === g ? null : g); this.page.set(1); this.rebuildView(); }
  toggleRarity(r: Rarity) { this.selectedRarity.set(this.selectedRarity() === r ? null : r); this.page.set(1); this.rebuildView(); }

  clearFilters() {
    this.selectedType.set(null);
    this.selectedGen.set(null);
    this.selectedRarity.set(null);
    this.page.set(1);
    this.rebuildView();
  }

  go(p: number) {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
    this.isAltMode() ? this.rebuildView() : this.loadPage();
  }

  // === Modal ===
  open(name: string) {
    this.modalOpen.set(true);
    this.ddata.set(null);
    this.loadEvolution(name);
    this.moves.set([]);              // limpia la lista de movimientos

    this.api.getPokemonByName(name).subscribe({
      next: (d: PokemonDetail) => {
        this.ddata.set(d);
        this.loadMovesFor(d);        // 👈 carga movimientos básicos
      },
      error: () => this.modalOpen.set(false)
    });
  }

  close(): void {
    this.modalOpen.set(false);
    this.ddata.set(null);
    this.moves.set([]);
  }

  private loadDetail(name: string) {
    this.dloading.set(true); this.derror.set(null);
    this.api.getPokemonByName(name).subscribe({
      next: d => { this.ddata.set(d); this.dloading.set(false); },
      error: () => { this.derror.set('No se encontró el Pokémon.'); this.dloading.set(false); },
    });
  }
  // Imagen para el modal (oficial si existe, si no sprite default)
  imageUrl(): string {
    const d = this.ddata();
    return (
      d?.sprites?.other?.['official-artwork']?.front_default ??
      d?.sprites?.front_default ??
      ''
    );
  }

  typesOfDetail(): string {
    const d = this.ddata();
    return d?.types?.map((t: any) => t.type.name).join(', ') ?? '';
  }



  // Tipos del detalle


  detailTypes(): string[] {
    const d = this.ddata();
    const types = d?.types ?? [];
    return types.map((t: PokemonDetail['types'][number]) => t.type.name);
  }


  typeChipClasses(t: string): string {
    const base = 'ring-1';
    const map: Record<string, string> = {
      normal: 'bg-neutral-800/60 text-neutral-200 ring-neutral-600/50',
      fighting: 'bg-red-900/40 text-red-300 ring-red-700/50',
      flying: 'bg-sky-900/40 text-sky-300 ring-sky-700/50',
      poison: 'bg-fuchsia-900/40 text-fuchsia-300 ring-fuchsia-700/50',
      ground: 'bg-amber-900/40 text-amber-300 ring-amber-700/50',
      rock: 'bg-yellow-900/40 text-yellow-300 ring-yellow-700/50',
      bug: 'bg-lime-900/40 text-lime-300 ring-lime-700/50',
      ghost: 'bg-violet-900/40 text-violet-300 ring-violet-700/50',
      steel: 'bg-slate-800/60 text-slate-200 ring-slate-600/50',
      fire: 'bg-orange-900/40 text-orange-300 ring-orange-700/50',
      water: 'bg-blue-900/40 text-blue-300 ring-blue-700/50',
      grass: 'bg-emerald-900/40 text-emerald-300 ring-emerald-700/50',
      electric: 'bg-yellow-700/40 text-yellow-200 ring-yellow-600/50',
      psychic: 'bg-pink-900/40 text-pink-300 ring-pink-700/50',
      ice: 'bg-cyan-900/40 text-cyan-300 ring-cyan-700/50',
      dragon: 'bg-indigo-900/40 text-indigo-300 ring-indigo-700/50',
      dark: 'bg-zinc-900/60 text-zinc-300 ring-zinc-700/50',
      fairy: 'bg-rose-900/40 text-rose-300 ring-rose-700/50',
    };
    return `${base} ${map[t] ?? 'bg-white/10 text-neutral-200 ring-white/10'}`;
  }


  private enrichPage(items: PokemonBasic[]) {
    const reqs = items.map(it =>
      this.api.getPokemonByName(it.name).pipe(
        map((d: PokemonDetail) => ({
          ...it,
          types: d.types.map(t => t.type.name),
          height: d.height,
          weight: d.weight,
          baseExp: d.base_experience
        })),
        catchError(() => of(it))
      )
    );
    forkJoin(reqs).subscribe({
      next: (enriched) => this.pokemons.set(enriched),
      error: () => this.pokemons.set(items),
    });
  }


  /** URL del grito (latest o legacy) tomado del detalle cargado en el modal */
  cryUrl(which: 'latest' | 'legacy' = 'latest'): string {
    const d = this.ddata();
    const url = d?.cries?.[which];
    return typeof url === 'string' ? url : '';
  }

  /** Reproduce el grito con un objeto Audio (con guardas para SSR) */
  playCry(which: 'latest' | 'legacy' = 'latest') {
    const url = this.cryUrl(which);
    if (!url) return;
    if (typeof window === 'undefined') return; // SSR guard

    const audio = new Audio(url);
    audio.play().catch(() => {
      // Silenciar fallos de autoplay/permiso; el usuario puede usar el <audio> controles
    });
  }

  /** Toma los primeros movimientos del detalle y trae su info básica */
  private loadMovesFor(d: PokemonDetail) {
    // Elige algunos (p.ej., 6 con poder definido; si no, completa hasta 6)
    const all = d.moves?.map(m => m.move) ?? [];
    const withPowerFirst = all.slice(0, 50); // ventana pequeña para no spamear
    const pick: { name: string; url: string }[] = [];

    // prioriza con power y rellena hasta 6
    for (const m of withPowerFirst) {
      if (pick.length >= 6) break;
      pick.push(m);
    }

    if (pick.length === 0) { this.moves.set([]); return; }

    const reqs = pick.map(m =>
      this.api.getMove(m.url).pipe(
        catchError(() => of(null))
      )
    );

    forkJoin(reqs).subscribe(list => {
      // filtra nulos y deja máximo 6
      const cleaned = (list.filter(Boolean) as MoveBasic[]).slice(0, 6);
      this.moves.set(cleaned);
    });
  }

  /** Stats base ordenadas y con etiqueta en ES */
  baseStats(): { key: string; label: string; value: number }[] {
    const d = this.ddata();
    const mapES: Record<string, string> = {
      hp: 'HP',
      attack: 'Ataque',
      defense: 'Defensa',
      'special-attack': 'Ataque especial',
      'special-defense': 'Defensa especial',
      speed: 'Velocidad',
    };
    const order = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];

    const stats = d?.stats ?? [];
    const byKey = new Map(stats.map(s => [s.stat.name, s.base_stat]));

    return order.map(k => ({
      key: k,
      label: mapES[k] ?? k,
      value: byKey.get(k) ?? 0,
    }));
  }

  /** Ancho para barra (0..100, cap en 150) */
  statWidth(v: number): string {
    const max = 150;            // referencia visual
    const pct = Math.min(100, Math.round((v / max) * 100));
    return `${pct}%`;
  }

private loadEvolution(nameOrId: string) {
  this.evolution.set([]);

  this.api.getSpecies(nameOrId).pipe(
    switchMap(sp => this.api.getEvolutionChain(sp.evolution_chain.url)),
    map(res => this.flattenChain(res.chain))   // → EvoStage[]
  )
  .subscribe({
    next: stages => this.evolution.set(stages),
    error: () => this.evolution.set([]),
  });
}

/** Convierte el árbol de la evolución en una lista lineal [base → 1ra → 2da …] */
private flattenChain(chain: any): EvoStage[] {
  const collect: EvoStage[] = [];

  const walk = (node: any) => {
    const name: string = node?.species?.name;
    if (!name) return;

    const id = this.extractIdFromSpeciesUrl(node.species.url);
    const imageUrl = artworkUrl(id);

    // Condición (simple) del primer detalle, si existe
    let note: string | undefined;
    const d = node?.evolution_details?.[0];
    if (d) {
      if (d.min_level != null) note = `Nv.${d.min_level}`;
      else if (d.item?.name) note = `Ítem: ${d.item.name}`;
      else if (d.trigger?.name) note = d.trigger.name; // p. ej., trade, use-item, level-up
      if (!note && d.time_of_day) note = d.time_of_day;
    }

    collect.push({ name, id, imageUrl, note });

    // Si hay ramificaciones, toma la primera (la mayoría de líneas son lineales)
    if (Array.isArray(node.evolves_to) && node.evolves_to.length) {
      // Si quieres mostrar TODAS las ramas, podríamos aplanar con separadores,
      // pero por simplicidad tomamos la primera
      walk(node.evolves_to[0]);
    }
  };

  walk(chain);
  return collect;
}

private extractIdFromSpeciesUrl(url: string): number {
  // /api/v2/pokemon-species/1/ → 1
  const parts = url.split('/').filter(Boolean);
  return Number(parts.at(-1));
}



}

/* ====================== Helpers (MISMO ARCHIVO) ====================== */
function extractIdFromUrl(url: string): number {
  const parts = url.split('/').filter(Boolean);
  return Number(parts.at(-1));
}
function artworkUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}
function inGeneration(id: number, gen?: number | null) {
  if (!gen) return true;
  const r = GEN_RANGES[gen];
  if (!r) return true;
  return id >= r[0] && id <= r[1];
}
/** Filtro base: prefijo (si ≥3), generación y set de tipo */
function filterCards(
  base: PokeListItem[],
  opts: { prefix?: string; typeSet?: Set<string> | null; generation?: number | null }
): CardItem[] {
  const q = (opts.prefix ?? '').trim().toLowerCase();
  const tset = opts.typeSet ?? null;

  const filtered = base.filter(item => {
    if (q.length >= 3 && !item.name.toLowerCase().startsWith(q)) return false;
    const id = extractIdFromUrl(item.url);
    if (!inGeneration(id, opts.generation)) return false;
    if (tset && !tset.has(item.name)) return false;
    return true;
  });

  // ✅ incluir id en cada card
  return filtered.map(i => {
    const id = extractIdFromUrl(i.url);
    return { id, name: i.name, imageUrl: artworkUrl(id) };
  });
}

/** Rareza desde species:
 * mythical → 'mythical', legendary → 'legendary',
 * si no: capture_rate <45 → 'very-rare', <100 → 'rare', si no 'common'
 */
// Rareza a partir de /pokemon-species
function rarityFromSpecies(s: PokemonSpecies): Rarity {
  if (s.is_mythical) return 'mythical';
  if (s.is_legendary) return 'legendary';
  // umbrales simples por captura (ajusta si quieres)
  if (s.capture_rate <= 45) return 'very-rare';
  if (s.capture_rate <= 90) return 'rare';
  return 'common';
}


