import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { MlFaceClient } from './ml-face.client';

@Module({
  controllers: [OnboardingController],
  providers: [OnboardingService, MlFaceClient],
})
export class OnboardingModule {}
