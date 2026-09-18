import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { lineTotal } from '../../../../core/utils/money';
import { CartItem } from '../../../cart/models/cart-item.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state';
import { IconComponent } from '../../../../shared/components/icon/icon';
import {
  selectCartIsEmpty,
  selectCartItems,
  selectCartSubtotal,
  selectCartTotal,
  selectCartTotalQuantity,
} from '../../../cart/store/cart.selectors';
import { CheckoutActions } from '../../store/checkout.actions';
import { selectSubmitting } from '../../store/checkout.reducer';

/** Loose on purpose: stricter email regexes reject valid addresses. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const POSTCODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\s-]{1,9}$/;

@Component({
  selector: 'app-checkout-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink, EmptyStateComponent, IconComponent],
  templateUrl: './checkout-page.html',
  styleUrl: './checkout-page.scss',
})
export class CheckoutPage {
  private readonly store = inject(Store);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly items = this.store.selectSignal(selectCartItems);
  protected readonly isEmpty = this.store.selectSignal(selectCartIsEmpty);
  protected readonly subtotal = this.store.selectSignal(selectCartSubtotal);
  protected readonly total = this.store.selectSignal(selectCartTotal);
  protected readonly totalQuantity = this.store.selectSignal(selectCartTotalQuantity);
  protected readonly submitting = this.store.selectSignal(selectSubmitting);

  /** Errors are shown only after a submit attempt or once a field is touched. */
  protected readonly submitAttempted = signal(false);

  protected readonly form: FormGroup = this.formBuilder.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.pattern(EMAIL_PATTERN)]],
    address: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(120)]],
    city: ['', [Validators.required, Validators.maxLength(60)]],
    postcode: ['', [Validators.required, Validators.pattern(POSTCODE_PATTERN)]],
  });

  protected lineTotal(item: CartItem): number {
    return lineTotal(item.price, item.quantity);
  }

  protected showError(control: string): boolean {
    const field = this.form.get(control);
    return field !== null && field.invalid && (field.touched || this.submitAttempted());
  }

  protected submit(): void {
    this.submitAttempted.set(true);
    if (this.form.invalid || this.isEmpty() || this.submitting()) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }

    this.store.dispatch(
      CheckoutActions.orderSubmitted({
        customer: this.form.getRawValue(),
        items: this.items(),
        total: this.total(),
      }),
    );
  }

  /** Keyboard and screen-reader users land on the field that needs attention. */
  private focusFirstInvalid(): void {
    const firstInvalid = Object.keys(this.form.controls).find(
      (key) => this.form.get(key)?.invalid === true,
    );
    if (firstInvalid !== undefined) {
      document.getElementById(firstInvalid)?.focus();
    }
  }
}
