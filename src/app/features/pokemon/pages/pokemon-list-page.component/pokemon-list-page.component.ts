import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PokeApiService } from '../../../../core/services/poke-api.service';

@Component({
  selector: 'app-pokemon-list-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pokemon-list-page.component.html',
})
export class PokemonListPageComponent implements OnInit {
  private api = inject(PokeApiService);

  // --- Paginación (20 fijos) ---
  pageSize = 20;
  page = signal(1);
  total = signal(0);
  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));

  // --- Lista paginada ---
  pokemons = signal<{ name: string; imageUrl: string }[]>([]);
  loading = signal(true);

  // --- Modal inline (detalle) ---
  modalOpen = signal(false);
  selectedName = signal<string | null>(null);
  ddata = signal<any | null>(null);
  dloading = signal(false);
  derror = signal<string | null>(null);

  // --- Buscador simple (≥3) ---
  q = signal('');
  searching = signal(false);
  results = signal<{ name: string; imageUrl: string }[]>([]);
  minQueryMet = computed(() => this.q().trim().length >= 3);

  ngOnInit(): void {
    this.loadPage();
  }

  // ====== PAGINACIÓN ======
  loadPage() {
    this.loading.set(true);
    const offset = (this.page() - 1) * this.pageSize; // <- offset correcto
    this.api.getPokemonPage(this.pageSize, offset).subscribe({
     next: ({ count, items }) => {
  this.total.set(count);
  this.pokemons.set(items);
  this.loading.set(false);

  // ✅ Evita error en SSR
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
},
      error: () => {
        this.total.set(0);
        this.pokemons.set([]);
        this.loading.set(false);
      }
    });
  }

  go(p: number) {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
    this.loadPage();
  }

  // ====== BUSCADOR (sin cache/almacenamiento) ======
  onSearchInput(value: string) {
    this.q.set(value);
    const text = value.trim().toLowerCase();

    if (text.length < 3) {
      this.results.set([]); // vuelve a mostrar lista paginada
      return;
    }

    this.searching.set(true);
    this.api.getAllBasic().subscribe({
      next: (list) => {
        this.results.set(filterByPrefix(list, text));
        this.searching.set(false);
      },
      error: () => {
        this.results.set([]);
        this.searching.set(false);
      }
    });
  }

  // ====== MODAL ======
  open(name: string) {
    this.selectedName.set(name);
    this.modalOpen.set(true);
    this.loadDetail(name);
  }
  close() {
    this.modalOpen.set(false);
    this.selectedName.set(null);
    this.ddata.set(null);
    this.derror.set(null);
    this.dloading.set(false);
  }
  private loadDetail(name: string) {
    this.dloading.set(true);
    this.derror.set(null);
    this.api.getPokemonByName(name).subscribe({
      next: d => { this.ddata.set(d); this.dloading.set(false); },
      error: () => { this.derror.set('No se encontró el Pokémon.'); this.dloading.set(false); },
    });
  }
  imageUrl(): string {
    const d = this.ddata();
    return d?.sprites?.other?.['official-artwork']?.front_default
        ?? d?.sprites?.front_default
        ?? '';
  }
  types(): string {
    const d = this.ddata();
    return d?.types?.map((t: any) => t.type.name).join(', ') ?? '';
  }
}

/* ===== Helper separado: filtra por prefijo y arma imagen ===== */
function filterByPrefix(
  list: Array<{ name: string; url: string }>,
  q: string
): Array<{ name: string; imageUrl: string }> {
  const qq = q.toLowerCase();
  return list
    .filter(item => item.name.toLowerCase().startsWith(qq))
    .map(item => {
      const parts = item.url.split('/').filter(Boolean);
      const id = Number(parts[parts.length - 1]);
      const imageUrl =
        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
      return { name: item.name, imageUrl };
    });
}
