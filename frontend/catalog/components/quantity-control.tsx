import { Icon } from "./icon";

export function QuantityControl({ name, quantity, maximum, disabled, onChange }: {
  name: string; quantity: number; maximum: number; disabled?: boolean; onChange: (quantity: number) => void;
}) {
  return <div className="stepper" role="group" aria-label={`Quantity of ${name}`}>
    <button type="button" aria-label={`Remove one ${name}`} disabled={disabled || quantity <= 0} onClick={() => onChange(quantity - 1)}><Icon name="minus" size={15} /></button>
    <output aria-label={`${name} quantity`}>{quantity}</output>
    <button type="button" aria-label={`Add one ${name}`} disabled={disabled || quantity >= maximum} onClick={() => onChange(quantity + 1)}><Icon name="plus" size={15} /></button>
  </div>;
}
