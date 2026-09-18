import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { MAX_CART_QUANTITY } from '../../../features/cart/models/cart-item.model';
import { QuantityStepperComponent } from './quantity-stepper';

describe('QuantityStepperComponent', () => {
  let fixture: ComponentFixture<QuantityStepperComponent>;

  async function render(quantity: number) {
    fixture = TestBed.createComponent(QuantityStepperComponent);
    fixture.componentRef.setInput('quantity', quantity);
    fixture.componentRef.setInput('label', 'Cotton Jacket');
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function buttonByName(element: HTMLElement, name: RegExp): HTMLButtonElement | undefined {
    return [...element.querySelectorAll('button')].find((button) =>
      name.test(button.textContent ?? ''),
    ) as HTMLButtonElement | undefined;
  }

  it('shows the current quantity', async () => {
    const element = await render(4);
    expect(element.querySelector('output')?.textContent?.trim()).toBe('4');
  });

  it('offers remove rather than decrement at the minimum quantity', async () => {
    // Reaching zero has to be a deliberate removal, not a stray minus click.
    const element = await render(1);

    expect(buttonByName(element, /Remove Cotton Jacket from cart/)).toBeDefined();
    expect(buttonByName(element, /Decrease quantity/)).toBeUndefined();
  });

  it('offers decrement above the minimum quantity', async () => {
    const element = await render(2);

    expect(buttonByName(element, /Decrease quantity of Cotton Jacket/)).toBeDefined();
    expect(buttonByName(element, /Remove/)).toBeUndefined();
  });

  it('emits remove from the minimum-quantity button', async () => {
    const element = await render(1);

    let removed = false;
    fixture.componentInstance.remove.subscribe(() => (removed = true));
    buttonByName(element, /Remove/)?.click();

    expect(removed).toBe(true);
  });

  it('emits increment and decrement', async () => {
    const element = await render(2);

    const events: string[] = [];
    fixture.componentInstance.increment.subscribe(() => events.push('increment'));
    fixture.componentInstance.decrement.subscribe(() => events.push('decrement'));

    buttonByName(element, /Increase quantity/)?.click();
    buttonByName(element, /Decrease quantity/)?.click();

    expect(events).toEqual(['increment', 'decrement']);
  });

  it('disables increment at the maximum quantity', async () => {
    const element = await render(MAX_CART_QUANTITY);
    expect(buttonByName(element, /Increase quantity/)?.disabled).toBe(true);
  });

  it('names every control for assistive technology', async () => {
    const element = await render(2);

    for (const button of element.querySelectorAll('button')) {
      expect(button.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    }
    expect(element.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(
      'Quantity for Cotton Jacket',
    );
  });
});
