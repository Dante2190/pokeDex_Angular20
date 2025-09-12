import { Routes } from '@angular/router';
import { PokemonListPageComponent } from './features/pokemon/pages/pokemon-list-page.component/pokemon-list-page.component';


export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'pokemon' },
  { path: 'pokemon', component: PokemonListPageComponent, title: 'Pokédex' },
  { path: '**', redirectTo: 'pokemon' },
];