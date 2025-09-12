// src/app/core/services/poke-api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';   // <-- IMPORTA Observable y map

interface PokemonListResponse {
  count: number;
  results: Array<{ name: string; url: string }>;
}

const BASE_URL = 'https://pokeapi.co/api/v2';

@Injectable({ providedIn: 'root' })
export class PokeApiService {
  constructor(private http: HttpClient) { }

  /** Lista simple (20 primeros) */
  getFirst20(): Observable<{ name: string; imageUrl: string }[]> {
    const params = new HttpParams().set('limit', 20).set('offset', 0);
    return this.http.get<PokemonListResponse>(`${BASE_URL}/pokemon`, { params }).pipe(
      map(res =>
        res.results.map(item => {
          const parts = item.url.split('/').filter(Boolean);
          const id = Number(parts[parts.length - 1]);
          const imageUrl =
            `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
          return { name: item.name, imageUrl };
        })
      )
    );
  }

  getAllBasic() {
    const params = new HttpParams().set('limit', 1500).set('offset', 0);
    return this.http.get<{ results: { name: string; url: string }[] }>(
      `${BASE_URL}/pokemon`,
      { params }
    ).pipe(map(res => res.results));
  }

  getPokemonPage(limit = 20, offset = 0) {
    const params = new HttpParams().set('limit', limit).set('offset', offset);
    return this.http.get<{ count: number; results: { name: string; url: string }[] }>(
      `${BASE_URL}/pokemon`, { params }
    ).pipe(
      map(res => {
        const items = res.results.map(item => {
          const parts = item.url.split('/').filter(Boolean);
          const id = Number(parts[parts.length - 1]);
          const imageUrl =
            `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
          return { name: item.name, imageUrl };
        });
        return { count: res.count, items };
      })
    );
  }


  /** Detalle por nombre o id */
  getPokemonByName(nameOrId: string): Observable<any> {
    return this.http.get<any>(`${BASE_URL}/pokemon/${nameOrId}`);
  }
}
