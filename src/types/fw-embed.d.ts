// Ambient JSX typing for Firework's <fw-embed-feed> custom element
// (loaded at runtime via their public embed script — see
// FireworkVideoFeed.tsx). Not part of the DOM lib, so TypeScript needs
// this declared or every usage errors as an unknown intrinsic element.
declare namespace JSX {
  interface IntrinsicElements {
    "fw-embed-feed": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      channel?: string;
      playlist?: string;
      size?: string;
      open_in?: string;
      widget_source?: string;
      title?: string;
      branding?: string;
      title_alignment?: string;
      auto_embed_widget?: string;
      mode?: string;
    };
  }
}
