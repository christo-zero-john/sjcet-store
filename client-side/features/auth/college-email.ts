const COLLEGE_EMAIL =
  /^[^@\s]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+sjcetpalai\.ac\.in$/i;

export function isAllowedCollegeEmail(email: string): boolean {
  return COLLEGE_EMAIL.test(email.trim());
}
