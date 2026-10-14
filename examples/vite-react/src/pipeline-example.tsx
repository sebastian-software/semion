import { Icon } from "semion";

export function SearchButton({
  pressed,
  onPress,
}: {
  pressed: boolean;
  onPress: () => void;
}) {
  return (
    <button
      className={`icon-button${pressed ? " is-pressed" : ""}`}
      type="button"
      aria-label="Search preview"
      aria-pressed={pressed}
      onClick={onPress}
    >
      <Icon name="search" aria-hidden="true" className="button-icon" />
    </button>
  );
}
