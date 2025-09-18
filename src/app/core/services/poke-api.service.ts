import { Injectable } from '@angular/core';

import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { PokemonListItem } from '../../shared/models/pokemon-list-item.model';
import { PokemonBasic } from '../../shared/models/pokemon-basic.model';
import { PokemonDetail } from '../../shared/models/pokemon-detail.model';
import { PokemonSpecies } from '../../shared/models/species.model';
import { MoveBasic } from '../../shared/models/move-basic.model';

const BASE_URL = 'https://pokeapi.co/api/v2';

@Injectable({ providedIn: 'root' })
export class PokeApiService {


  constructor(private http: HttpClient) { }

  // Página de 20 (limit/offset)
  getPokemonPage(limit = 20, offset = 0): Observable<{ count: number; items: PokemonBasic[] }> {
    const params = new HttpParams().set('limit', String(limit)).set('offset', String(offset));

    return this.http.get<{ count: number; results: PokemonListItem[] }>(
      `${BASE_URL}/pokemon`, { params }
    ).pipe(
      map(res => {
        const items: PokemonBasic[] = res.results.map(item => {
          const parts = item.url.split('/').filter(Boolean);
          const id = Number(parts[parts.length - 1]);
          const imageUrl =
            `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
          return { id, name: item.name, imageUrl };
        });
        return { count: res.count, items };
      })
    );
  }

  // Lista “grande” (para filtrar localmente)
  getAllBasic(): Observable<PokemonListItem[]> {
    const params = new HttpParams().set('limit', '2000').set('offset', '0');
    return this.http
      .get<{ results: PokemonListItem[] }>(`${BASE_URL}/pokemon`, { params })
      .pipe(map(res => res.results));
  }

  // Detalle (para modal y enriquecer las cards)
  getPokemonByName(nameOrId: string): Observable<PokemonDetail> {
    return this.http.get<PokemonDetail>(`${BASE_URL}/pokemon/${nameOrId}`);
  }

  // Tipos
  getTypes(): Observable<string[]> {
    return this.http
      .get<{ results: { name: string; url: string }[] }>(`${BASE_URL}/type`)
      .pipe(map(res => res.results.map(t => t.name)));
  }

  // Nombres por tipo (para filtrar por tipo)
  getPokemonNamesByType(type: string): Observable<string[]> {
    return this.http.get<{ pokemon: Array<{ pokemon: { name: string } }> }>(`${BASE_URL}/type/${type}`)
      .pipe(map(res => res.pokemon.map(x => x.pokemon.name)));
  }

  // 🔹 species (para obtener la URL de la evolución)
  getSpecies(nameOrId: string) {
    return this.http.get<{ evolution_chain: { url: string } }>(
      `${BASE_URL}/pokemon-species/${nameOrId}`
    );
  }

  // 🔹 evolution-chain (estructura del árbol)
  getEvolutionChain(url: string) {
    // la URL ya viene completa, ¡úsala tal cual!
    return this.http.get<{
      id: number;
      chain: {
        species: { name: string; url: string };
        evolves_to: any[];
        evolution_details: Array<{
          min_level?: number | null;
          trigger?: { name: string };
          item?: { name: string };
          happiness?: number | null;
          time_of_day?: string;
        }>;
      };
    }>(url);
  }


  getMove(ref: string) {
    const url = ref.startsWith('http') ? ref : `${BASE_URL}/move/${ref}`;
    return this.http.get<MoveBasic>(url);
  }

}
