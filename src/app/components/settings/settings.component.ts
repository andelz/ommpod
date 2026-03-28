import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SolidAuthService } from '../../services/solid-auth.service';
import { SolidSyncService } from '../../services/solid-sync.service';
import { UpdateService } from '../../services/update.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [TranslateModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private translate = inject(TranslateService);
  solidAuth = inject(SolidAuthService);
  solidSync = inject(SolidSyncService);
  updateService = inject(UpdateService);

  languages = [
    { code: 'en', label: 'English' },
    { code: 'de', label: 'Deutsch' },
  ];

  currentLang = signal(this.translate.currentLang ?? this.translate.defaultLang ?? 'en');
  issuerUrl = signal(this.solidAuth.savedIssuer);

  selectLanguage(code: string) {
    this.translate.use(code);
    this.currentLang.set(code);
    localStorage.setItem('lang', code);
  }

  connectSolid() {
    this.solidAuth.login(this.issuerUrl());
  }

  disconnectSolid() {
    this.solidAuth.logout();
  }

  syncNow() {
    this.solidSync.fullSync();
  }
}
