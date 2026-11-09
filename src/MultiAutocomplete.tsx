import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { norm } from '../shared/model';

export function MultiAutocomplete({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; name: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const matches = options.filter((o) => norm(o.name).includes(norm(query).trim()));
  const toggle = (option: string) => {
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);
    setQuery('');
    setActive(-1);
  };
  useEffect(() => {
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  useEffect(() => {
    if (open) list.current?.scrollIntoView({ block: 'nearest' });
  }, [open]);

  return (
    <div
      className="country-select"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
          setQuery('');
          setActive(-1);
        }
      }}
    >
      <label htmlFor={id}>{label}</label>
      <div className="country-select-control">
        <input
          id={id}
          ref={input}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={id + '-options'}
          aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
          autoComplete="off"
          placeholder="Buscar y seleccionar regiones"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setOpen(true);
              setActive((n) =>
                !matches.length
                  ? -1
                  : n < 0
                    ? e.key === 'ArrowDown'
                      ? 0
                      : matches.length - 1
                    : (n + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length,
              );
            } else if (e.key === 'Enter' && open) {
              e.preventDefault();
              const option = matches[active] || (matches.length === 1 ? matches[0] : undefined);
              if (option) toggle(option.id);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setOpen(false);
              setQuery('');
              setActive(-1);
            }
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Mostrar regiones de cobertura"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            input.current?.focus();
            setOpen(!open);
            setActive(-1);
          }}
        >
          <ChevronDown size={18} />
        </button>
      </div>
      {open && (
        <div className="country-select-dropdown">
          <ul
            ref={list}
            id={id + '-options'}
            role="listbox"
            aria-label={label}
            aria-multiselectable="true"
          >
            {matches.map((o, i) => (
              <li
                key={o.id}
                id={`${id}-option-${i}`}
                role="option"
                aria-selected={value.includes(o.id)}
                data-active={active === i}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => toggle(o.id)}
              >
                {o.name}
                {value.includes(o.id) && <Check size={16} aria-hidden="true" />}
              </li>
            ))}
          </ul>
          {!matches.length && <p role="status">No se encontraron regiones.</p>}
        </div>
      )}
      <div className="coverage-chips" role="group" aria-label="Regiones seleccionadas">
        {value.map((v) => {
          const name = options.find((o) => o.id === v)?.name || v;
          return (
            <button
              type="button"
              key={v}
              aria-label={'Quitar ' + name}
              onClick={() => onChange(value.filter((selected) => selected !== v))}
            >
              {name}
              <X size={14} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
