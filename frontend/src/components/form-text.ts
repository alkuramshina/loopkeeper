// Reads a text field from a submitted form; missing fields and file inputs
// read as an empty string.
export function formText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}
