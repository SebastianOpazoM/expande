import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { norm } from '../shared/model';

const names = new Intl.DisplayNames(['es'], { type: 'region' });
const countries =
  `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`
    .split(/\s+/)
    .map((id) => ({ id, name: names.of(id) || id }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

export function CountrySelect({
  defaultValue = '',
  onChange,
}: {
  defaultValue?: string;
  onChange?: (code: string) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const options =
    defaultValue && !countries.some((c) => c.id === defaultValue)
      ? [...countries, { id: defaultValue, name: defaultValue }]
      : countries;
  const countryName = (code: string) => options.find((c) => c.id === code)?.name || '';
  const [selected, setSelected] = useState(defaultValue);
  const [query, setQuery] = useState(countryName(defaultValue));
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(-1);
  const matches = options.filter(
    (c) => !searching || norm(`${c.name} ${c.id}`).includes(norm(query).trim()),
  );
  const choose = (code: string) => {
    setSelected(code);
    onChange?.(code);
    setQuery(countryName(code));
    setSearching(false);
    setOpen(false);
    setActive(-1);
  };
  useEffect(() => {
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <div className="country-select">
      <label htmlFor={id}>País</label>
      <input type="hidden" name="country" value={selected} />
      <div className="country-select-control">
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={id + '-options'}
          aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
          autoComplete="off"
          placeholder="Busca un país"
          value={query}
          onFocus={() => {
            setOpen(true);
            setSearching(false);
            setActive(-1);
          }}
          onBlur={() => choose(selected)}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearching(true);
            setOpen(true);
            setActive(-1);
            if (!e.target.value) {
              setSelected('');
              onChange?.('');
            }
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
              if (active >= 0 && matches[active]) choose(matches[active].id);
              else if (matches.length === 1) choose(matches[0].id);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              choose(selected);
            }
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Mostrar países"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            input.current?.focus();
            setSearching(false);
            setOpen(!open);
          }}
        >
          <ChevronDown size={18} />
        </button>
      </div>
      {open && (
        <div className="country-select-dropdown">
          <ul ref={list} id={id + '-options'} role="listbox" aria-label="Países">
            {matches.map((c, i) => (
              <li
                key={c.id}
                id={`${id}-option-${i}`}
                role="option"
                aria-selected={selected === c.id}
                data-active={active === i}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(c.id)}
              >
                {c.name}
                <small>{c.id}</small>
              </li>
            ))}
          </ul>
          {!matches.length && <p role="status">No se encontraron países.</p>}
        </div>
      )}
    </div>
  );
}
