import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { AppError } from '../../../core/models/app-error.model';
import { CategoryFilter, Product, ProductSort } from '../../../core/models/product.model';

export const ProductsActions = createActionGroup({
  source: 'Products',
  events: {
    'Catalogue Requested': emptyProps(),
    'Catalogue Loaded': props<{ products: readonly Product[] }>(),
    'Catalogue Failed': props<{ error: AppError }>(),

    'Product Requested': props<{ id: number }>(),
    'Product Loaded': props<{ product: Product }>(),
    'Product Failed': props<{ error: AppError }>(),

    'Search Changed': props<{ search: string }>(),
    'Category Changed': props<{ category: CategoryFilter }>(),
    'Sort Changed': props<{ sort: ProductSort }>(),
    'Filters Cleared': emptyProps(),

    'Next Page Requested': emptyProps(),
    'All Pages Requested': emptyProps(),
  },
});
