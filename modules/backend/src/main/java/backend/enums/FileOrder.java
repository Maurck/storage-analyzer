package backend.enums;

/** How a search sorts the files it matches. Ties always fall back to the path. */
public enum FileOrder {
    /** Largest first. */
    LARGEST,
    /** Least recently modified first; files whose time is unknown come last. */
    OLDEST,
    /** Most recently modified first; files whose time is unknown come last. */
    NEWEST,
}
