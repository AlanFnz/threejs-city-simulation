import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { MAX_CITY_NAME_LENGTH } from '../../game/cityName';

interface CityNameProps {
  name: string;
  onRename: (name: string) => void;
}

function CityName({ name, onRename }: CityNameProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isEditing) setDraft(name);
  }, [isEditing, name]);

  useEffect(() => {
    if (!isEditing) return;
    input.current?.focus();
    input.current?.select();
  }, [isEditing]);

  const commit = () => {
    onRename(draft);
    setIsEditing(false);
  };

  const cancel = () => {
    setDraft(name);
    setIsEditing(false);
    requestAnimationFrame(() => trigger.current?.focus());
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    commit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    cancel();
  };

  if (isEditing) {
    return (
      <form className="city-name-editor" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="city-name-input">
          City name
        </label>
        <input
          id="city-name-input"
          ref={input}
          value={draft}
          maxLength={MAX_CITY_NAME_LENGTH}
          autoComplete="off"
          spellCheck="false"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
        />
      </form>
    );
  }

  return (
    <button
      ref={trigger}
      className="city-name"
      type="button"
      aria-label={`Rename ${name}`}
      title="Rename city"
      onClick={() => setIsEditing(true)}
    >
      <span>{name}</span>
      <span className="city-name-edit-icon" aria-hidden="true">
        ✎
      </span>
    </button>
  );
}

export { CityName };
