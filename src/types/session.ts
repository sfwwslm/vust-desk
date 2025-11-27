export interface Claims {
  sub: string;
  username: string;
  exp: number;
  iss: string;
  roles?: string[];
}

export interface loginResponse {
  accessToken: string;
  tokenType: string;
}
