import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
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
  updateService = inject(UpdateService);

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
