import { useEffect, useState } from "react";
import { listSectors } from "../api/sectors";
import type { Sector, SignupSectorInput } from "../api/types";

interface SectorChipsProps {
  value: SignupSectorInput[];
  onChange: (sectors: SignupSectorInput[]) => void;
}

const OTHER_KEY = "__other__";

export function SectorChips({ value, onChange }: SectorChipsProps) {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [otherSelected, setOtherSelected] = useState(false);
  const [otherText, setOtherText] = useState("");

  useEffect(() => {
    listSectors()
      .then((all) => setSectors(all.filter((s) => !s.is_custom)))
      .catch(() => setSectors([]));
  }, []);

  const isSelected = (key: string) => value.some((s) => s.key === key);

  function toggleSector(sector: Sector) {
    if (isSelected(sector.key)) {
      onChange(value.filter((s) => s.key !== sector.key));
    } else {
      onChange([...value, { key: sector.key, label: sector.label }]);
    }
  }

  function toggleOther() {
    const next = !otherSelected;
    setOtherSelected(next);
    if (!next) {
      setOtherText("");
      onChange(value.filter((s) => s.key !== OTHER_KEY));
    }
  }

  function updateOtherText(text: string) {
    setOtherText(text);
    const trimmed = text.trim();
    const withoutOther = value.filter((s) => s.key !== OTHER_KEY);
    if (trimmed) {
      onChange([...withoutOther, { key: OTHER_KEY, label: trimmed }]);
    } else {
      onChange(withoutOther);
    }
  }

  return (
    <div className="pt-sm">
      <label className="block font-label text-label text-on-surface mb-xs">Sector(s) needed</label>
      <div className="flex flex-wrap gap-xs chip-container">
        {sectors.map((sector) => (
          <button
            key={sector.key}
            type="button"
            onClick={() => toggleSector(sector)}
            className={`chip px-sm py-xs border border-outline-variant rounded bg-[#F1F5F9] text-[#64748B] font-small text-xs ${
              isSelected(sector.key) ? "selected" : ""
            }`}
          >
            {sector.label}
          </button>
        ))}
        <button
          type="button"
          onClick={toggleOther}
          className={`chip px-sm py-xs border border-outline-variant rounded bg-[#F1F5F9] text-[#64748B] font-small text-xs ${
            otherSelected ? "selected" : ""
          }`}
        >
          Other
        </button>
      </div>
      {otherSelected && (
        <div className="mt-xs">
          <input
            className="input-field w-full px-sm py-xs bg-surface-container-lowest border border-outline-variant rounded font-body-md text-on-surface placeholder:text-on-surface-variant text-sm"
            placeholder="Specify sector..."
            type="text"
            value={otherText}
            onChange={(e) => updateOtherText(e.target.value)}
            autoFocus
          />
        </div>
      )}
    </div>
  );
}
