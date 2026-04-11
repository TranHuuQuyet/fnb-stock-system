import { SetMetadata } from '@nestjs/common';

export const REQUIRE_BUSINESS_NETWORK_KEY = 'require_business_network';
export const RequireBusinessNetwork = () =>
  SetMetadata(REQUIRE_BUSINESS_NETWORK_KEY, true);
