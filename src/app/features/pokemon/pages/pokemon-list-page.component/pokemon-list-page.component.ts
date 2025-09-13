import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { PokeApiService } from '../../../../core/services/poke-api.service';

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
type Rarity = 'common' | 'rare' | 'very-rare' | 'legendary' | 'mythical';

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
  selectedName = signal<string | null>(null);
  ddata = signal<any | null>(null);
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
  open(name: string) { this.selectedName.set(name); this.modalOpen.set(true); this.loadDetail(name); }
  close() { this.modalOpen.set(false); this.selectedName.set(null); this.ddata.set(null); this.derror.set(null); this.dloading.set(false); }
  private loadDetail(name: string) {
    this.dloading.set(true); this.derror.set(null);
    this.api.getPokemonByName(name).subscribe({
      next: d => { this.ddata.set(d); this.dloading.set(false); },
      error: () => { this.derror.set('No se encontró el Pokémon.'); this.dloading.set(false); },
    });
  }
  imageUrl(): string {
    const d = this.ddata();
    return d?.sprites?.other?.['official-artwork']?.front_default ?? d?.sprites?.front_default ?? '';
  }
  typesOfDetail(): string {
    const d = this.ddata();
    return d?.types?.map((t: any) => t.type.name).join(', ') ?? '';
  }

  // …dentro de la clase

  detailTypes(): string[] {
    const d = this.ddata();
    return d?.types?.map((t: any) => t.type.name) ?? [];


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


  private enrichPage(items: CardItem[]) {
    // Traemos detalle de los 20 visibles para obtener tipos/altura/peso/exp
    const reqs = items.map(it =>
      this.api.getPokemonByName(it.name).pipe(
        map(d => ({
          ...it,
          types: (d?.types ?? []).map((t: any) => t.type.name as string),
          height: d?.height,
          weight: d?.weight,
          baseExp: d?.base_experience
        })),
        catchError(() => of(it)) // si falla alguno, dejamos la card básica
      )
    );

    forkJoin(reqs).subscribe({
      next: enriched => this.pokemons.set(enriched),
      error: () => this.pokemons.set(items),
    });
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
function rarityFromSpecies(sp: any): Rarity {
  if (sp?.is_mythical) return 'mythical';
  if (sp?.is_legendary) return 'legendary';
  const c = Number(sp?.capture_rate ?? 100);
  if (c < 45) return 'very-rare';
  if (c < 100) return 'rare';
  return 'common';
}


