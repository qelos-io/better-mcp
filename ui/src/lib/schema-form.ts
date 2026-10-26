export type FieldKind = "string" | "number" | "integer" | "boolean" | "enum" | "json";

export interface SchemaField {
  name: string;
  kind: FieldKind;
  required: boolean;
  description?: string;
  options?: string[];
  default?: unknown;
}

type Schema = Record<string, unknown>;
const isObject = (v: unknown): v is Schema => !!v && typeof v === "object" && !Array.isArray(v);

function kindOf(prop: Schema): { kind: FieldKind; options?: string[] } {
  if (Array.isArray(prop.enum) && prop.enum.length && prop.enum.every((x) => typeof x === "string")) {
    return { kind: "enum", options: prop.enum as string[] };
  }
  const t = Array.isArray(prop.type) ? (prop.type as unknown[]).find((x) => x !== "null") : prop.type;
  if (t === "string" || t === "number" || t === "integer" || t === "boolean") return { kind: t };
  return { kind: "json" };
}

/** Form fields for an object schema's top-level properties, required ones first; null when there is nothing to build a form from. */
export function fieldsFromSchema(schema: unknown): SchemaField[] | null {
  if (!isObject(schema) || !isObject(schema.properties)) return null;
  const required = new Set(Array.isArray(schema.required) ? (schema.required as string[]) : []);
  const fields = Object.entries(schema.properties).map(([name, p]): SchemaField => {
    const prop = isObject(p) ? p : {};
    return {
      name,
      ...kindOf(prop),
      required: required.has(name),
      description: typeof prop.description === "string" ? prop.description : undefined,
      default: prop.default,
    };
  });
  if (!fields.length) return null;
  return [...fields.filter((f) => f.required), ...fields.filter((f) => !f.required)];
}

export type FieldValues = Record<string, string | boolean>;

export function initialValues(fields: SchemaField[]): FieldValues {
  const out: FieldValues = {};
  for (const f of fields) {
    if (f.kind === "boolean") out[f.name] = f.default === true;
    else if (f.default !== undefined && f.default !== null) out[f.name] = typeof f.default === "string" ? f.default : JSON.stringify(f.default);
    else out[f.name] = "";
  }
  return out;
}

export function buildArgs(fields: SchemaField[], values: FieldValues): { args: Record<string, unknown>; errors: Record<string, string> } {
  const args: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const raw = values[f.name];
    if (f.kind === "boolean") {
      if (raw === true || f.required) args[f.name] = raw === true;
      continue;
    }
    const text = typeof raw === "string" ? raw.trim() : "";
    if (!text) {
      if (f.required) errors[f.name] = "Required.";
      continue;
    }
    if (f.kind === "number" || f.kind === "integer") {
      const n = Number(text);
      if (!Number.isFinite(n)) errors[f.name] = "Enter a number.";
      else if (f.kind === "integer" && !Number.isInteger(n)) errors[f.name] = "Enter a whole number.";
      else args[f.name] = n;
    } else if (f.kind === "json") {
      try {
        args[f.name] = JSON.parse(text);
      } catch {
        errors[f.name] = "Enter valid JSON.";
      }
    } else {
      args[f.name] = typeof raw === "string" ? raw : text;
    }
  }
  return { args, errors };
}
