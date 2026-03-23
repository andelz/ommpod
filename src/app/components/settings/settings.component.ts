import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private translate = inject(TranslateService);

  languages = [
    { code: 'en', label: 'English' },
    { code: 'de', label: 'Deutsch' },
  ];

  currentLang = signal(this.translate.currentLang ?? this.translate.defaultLang ?? 'en');

  selectLanguage(code: string) {
    this.translate.use(code);
    this.currentLang.set(code);
    localStorage.setItem('lang', code);
  }
}
