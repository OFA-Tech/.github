/** Wire DTOs for the Docker Hub v2 API. These never leave this layer. */

export interface DockerHubTagDto {
  name?: string;
}

export interface DockerHubTagListDto {
  results?: DockerHubTagDto[];
}
